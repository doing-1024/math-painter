import type { Scene, Shape, Vec } from '../core/types';
import { CommandStack, addShapeCommand, addShapesCommand, replaceShapesCommand, deleteShapesCommand } from '../core/commands';
import { IdGenerator } from '../core/ids';
import { cloneShape } from '../core/util';
import { pickPoint } from '../core/snap';
import { parseScene, serializeScene, MAX_IMPORT_BYTES, ParseError } from '../io/scene-file';
import { getShapeDefinition, translateShape } from '../core/shapes/registry';
import { sceneToSVG, type SVGOptions } from '../io/svg';
import { renderSceneToCanvas, type ExportOptions } from '../io/canvas';
import { Selection } from './selection';
import { LabelLayer } from './label-layer';

const STORAGE_KEY = 'math-painter:v1';
import { Viewport } from './viewport';
import type { ToolRegistry } from '../tools/registry';
import type { Tool, EditorContext } from '../tools/types';
import type { CanvasRenderer } from '../render/renderer';

export class Editor implements EditorContext {
  scene: Scene = { shapes: {}, order: [] };
  selection = new Selection();
  viewport = new Viewport();
  commands: CommandStack;
  idgen = new IdGenerator();
  private clipboard: Shape[] = [];
  activeTool: Tool;
  lastSnap: Vec | null = null;
  hoverId: string | null = null;
  status = 'READY';
  onToolChange?: (id: string) => void;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly tools: ToolRegistry,
    private readonly renderer: CanvasRenderer,
    private readonly statusEl: HTMLElement,
    private readonly labelLayer: LabelLayer,
  ) {
    this.commands = new CommandStack(() => {
      this.draw();
      this.schedulePersist();
    });
    const select = this.tools.get('select');
    if (!select) throw new Error('select tool missing');
    this.activeTool = select;
    this.loadPersisted();
    window.addEventListener('beforeunload', () => this.persist());
  }

  /** Persist the current scene + viewport to localStorage (debounced), so the
   *  drawing survives a reload without an explicit save action. */
  private schedulePersist(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 400);
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ scene: this.scene, viewport: this.viewport }));
    } catch {
      /* storage unavailable or over quota: ignore */
    }
  }

  private loadPersisted(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { scene?: unknown; viewport?: Record<string, number> };
      if (data.scene) {
        this.scene = parseScene(data.scene);
        this.idgen.advance(this.scene);
      }
      if (data.viewport) Object.assign(this.viewport, data.viewport);
    } catch {
      /* corrupt storage: ignore and start fresh */
    }
  }

  setTool(id: string): void {
    const tool = this.tools.get(id);
    if (!tool) return;
    if (tool !== this.activeTool) {
      this.activeTool.deactivate?.(this);
      this.activeTool = tool;
      tool.activate?.(this);
    }
    this.lastSnap = null;
    this.status = `-- ${id.toUpperCase()} --`;
    this.onToolChange?.(id);
    this.draw();
  }

  add(shape: Shape): void {
    this.commands.push(addShapeCommand(this.scene, shape));
    this.selection.set([shape.id]);
  }

  replace(before: Map<string, Shape>, after: Map<string, Shape>): void {
    this.commands.push(replaceShapesCommand(this.scene, before, after));
  }

  deleteShapes(ids: string[]): void {
    const toDelete = new Set(ids);
    // cascade: any shape that references a deleted shape goes with it. The
    // cascade logic lives in each shape definition (cascadeIds), so the core
    // does not switch on shape.type.
    for (const id of this.scene.order) {
      const shape = this.scene.shapes[id];
      if (!shape) continue;
      const extra = getShapeDefinition(shape.type)?.cascadeIds?.(shape) ?? [];
      if (extra.some((eid) => toDelete.has(eid))) toDelete.add(id);
    }
    const shapes = [...toDelete].map((id) => cloneShape(this.scene.shapes[id])).filter(Boolean) as Shape[];
    const order = [...this.scene.order];
    this.commands.push(deleteShapesCommand(this.scene, shapes, order));
    this.selection.clear();
  }

  promptText(message: string, defaultValue = ''): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'prompt-input';
      input.placeholder = message;
      input.value = defaultValue;
      document.body.appendChild(input);
      let done = false;
      const finish = (value: string | null): void => {
        if (done) return;
        done = true;
        input.remove();
        resolve(value);
      };
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(input.value.trim());
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(null);
        }
      });
      input.addEventListener('blur', () => finish(null));
      // Defer focus to the next tick: focusing synchronously inside the
      // pointerdown handler makes the browser hand focus back to the canvas
      // (its click default), which fires `blur` and removes the input instantly.
      const focusInput = (): void => {
        if (done) return;
        input.focus();
        input.select();
      };
      setTimeout(focusInput, 0);
    });
  }

  deleteSelected(): void {
    const ids = this.selection.list().filter((id) => this.scene.shapes[id]);
    if (ids.length) this.deleteShapes(ids);
  }

  /** Copy the current selection into an internal clipboard. Each copied shape
   * gets a fresh id so a later paste never collides with the originals. */
  copySelection(): void {
    const ids = this.selection.list().filter((id) => this.scene.shapes[id]);
    if (!ids.length) {
      this.setStatus('COPY: 未选择图形');
      return;
    }
    this.clipboard = ids.map((id) => {
      const s = cloneShape(this.scene.shapes[id]);
      s.id = this.idgen.next();
      return s;
    });
    this.setStatus(`COPIED ${this.clipboard.length}`);
  }

  /** Paste the clipboard as new shapes, offset a little so they don't sit
   * exactly on the originals. Each paste reassigns ids, so repeated paste
   * keeps producing distinct shapes. The whole paste is one undo step. */
  paste(): void {
    if (!this.clipboard.length) {
      this.setStatus('PASTE: 剪贴板为空');
      return;
    }
    const d = 16 / this.viewport.scale;
    const delta: Vec = { x: d, y: d };
    const added = this.clipboard.map((s) => {
      const c = cloneShape(s);
      c.id = this.idgen.next();
      return translateShape(c, delta);
    });
    this.commands.push(addShapesCommand(this.scene, added));
    this.selection.set(added.map((s) => s.id));
    this.setStatus(`PASTED ${added.length}`);
    this.draw();
  }

  /** Show a small choice menu and resolve with the chosen option key (or null
   *  on Escape / dismiss). Used by the polygon tool to pick regular vs free. */
  promptChoice(title: string, options: { key: string; label: string }[]): Promise<string | null> {
    return new Promise((resolve) => {
      document.getElementById('choice-box')?.remove();
      const box = document.createElement('div');
      box.className = 'choice-box';
      box.id = 'choice-box';
      const titleEl = document.createElement('div');
      titleEl.className = 'choice-title';
      titleEl.textContent = title;
      box.appendChild(titleEl);
      let done = false;
      const finish = (key: string | null): void => {
        if (done) return;
        done = true;
        box.remove();
        document.removeEventListener('keydown', onKey, true);
        resolve(key);
      };
      const onKey = (event: KeyboardEvent): void => {
        const opt = options.find((o) => o.key.toLowerCase() === event.key.toLowerCase());
        if (opt) {
          event.preventDefault();
          event.stopPropagation();
          finish(opt.key);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(null);
        } else {
          // Any other key dismisses the modal choice so it cannot linger over
          // a newly selected tool (e.g. pressing a drawing shortcut).
          event.preventDefault();
          finish(null);
        }
      };
      document.addEventListener('keydown', onKey, true);
      for (const o of options) {
        const item = document.createElement('button');
        item.className = 'choice-item';
        item.textContent = `[${o.key}] ${o.label}`;
        item.addEventListener('mousedown', (event) => {
          event.preventDefault();
          finish(o.key);
        });
        box.appendChild(item);
      }
      document.body.appendChild(box);
    });
  }

  snap(world: Vec, extra: Vec[] = [], exclude?: string[]): Vec {
    const { point, snap } = pickPoint(this.scene, world, this.viewport.scale, extra, exclude ? new Set(exclude) : null);
    this.lastSnap = snap ? { ...snap } : null;
    return point;
  }

  undo(): void {
    this.commands.undo();
  }

  redo(): void {
    this.commands.redo();
  }

  setStatus(message: string): void {
    this.status = message;
    this.draw();
  }

  setStatusText(message: string): void {
    this.status = message;
  }

  measure(): void {
    this.renderer.measure();
    this.draw();
  }

  draw(): void {
    const rect = this.renderer.resize();
    if (rect.width === 0 || rect.height === 0) return;
    this.renderer.clear();
    this.renderer.drawGrid(rect, this.viewport);
    this.renderer.beginWorld(this.viewport);
    for (const id of this.scene.order) {
      const shape = this.scene.shapes[id];
      if (!shape) continue;
      try {
        this.renderer.drawShape(shape, this.selection.has(id) || this.hoverId === id);
      } catch (error) {
        console.error('[math-painter] draw error', error);
      }
    }
    try {
      this.activeTool.drawOverlay?.(this.renderer);
    } catch (error) {
      console.error('[math-painter] overlay error', error);
    }
    if (this.lastSnap) this.renderer.drawSnap(this.lastSnap);
    this.renderer.endWorld();
    // Labels live in the HTML overlay, positioned in screen space.
    this.labelLayer.render(this.scene, this.selection, this.viewport);
    this.statusEl.textContent = `${this.status} | tool=${this.activeTool.id} | n=${this.scene.order.length} | z=${this.viewport.scale.toFixed(2)} | undo=${this.commands.canUndo ? 'Y' : '-'}`;
  }

  exportScene(): void {
    const blob = new Blob([serializeScene(this.scene)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'math-painter.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Toggle the `hidden` flag on the current selection (hide construction
   *  lines; hidden shapes are dimmed on screen and omitted from SVG export). */
  toggleHidden(): void {
    const ids = this.selection.list().filter((id) => this.scene.shapes[id]);
    if (!ids.length) {
      this.setStatus('HIDDEN: nothing selected');
      return;
    }
    const before = new Map<string, Shape>();
    const after = new Map<string, Shape>();
    for (const id of ids) {
      const s = cloneShape(this.scene.shapes[id]);
      const next = cloneShape(s);
      if (s.hidden) delete next.hidden;
      else next.hidden = true;
      before.set(id, s);
      after.set(id, next);
    }
    this.replace(before, after);
    this.setStatus('HIDDEN: toggled');
  }

  /** Return the scene as an SVG string (white background, dark ink, auto-cropped
   *  to content bounds). The export plugin downloads it. */
  exportSVGString(opts?: SVGOptions): string {
    return sceneToSVG(this.scene, opts);
  }

  /** Render the scene to a PNG-ready canvas (white background, black ink,
   *  auto-cropped). Returns null when the scene is empty. The export plugin
   *  rasterizes it. */
  exportCanvas(opts?: ExportOptions): HTMLCanvasElement | null {
    return renderSceneToCanvas(this.scene, opts);
  }

  async importScene(file: File): Promise<void> {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('file too large');
      const data = parseScene(JSON.parse(await file.text()));
      if (!data) throw new Error('invalid scene');
      this.scene = data;
      this.idgen.advance(this.scene);
      this.selection.clear();
      this.commands.clear();
      this.setStatus('IMPORTED');
      this.schedulePersist();
    } catch (error) {
      this.setStatus(error instanceof ParseError ? `IMPORT: ${error.message}` : 'IMPORT ERROR');
    }
  }
}
