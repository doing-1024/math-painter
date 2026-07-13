import type { Editor } from './editor';
import type { Vec } from '../core/types';
import { hitTest } from '../core/shapes/registry';
import type { PointerInput } from '../tools/types';
import { PolygonTool } from '../tools/polygon';

export class InputController {
  private pan: { startScreen: Vec; origin: Vec } | null = null;
  private spaceDown = false;
  private readonly pluginKeys = new Map<string, string>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly editor: Editor,
    private readonly getRect: () => DOMRect,
    private readonly fileInput: HTMLInputElement,
  ) {}

  attach(): void {
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onCancel);
    this.canvas.addEventListener('lostpointercapture', this.onCancel);
    this.canvas.addEventListener('dblclick', this.onDbl);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private input(event: PointerEvent): PointerInput {
    const rect = this.getRect();
    return {
      client: { x: event.clientX, y: event.clientY },
      rawWorld: this.editor.viewport.toWorld(event.clientX, event.clientY, rect),
      button: event.button,
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: event.ctrlKey || event.metaKey,
    };
  }

  private onDown = (event: PointerEvent): void => {
    this.canvas.setPointerCapture(event.pointerId);
    const input = this.input(event);
    if (event.button === 1 || input.alt || this.spaceDown) {
      this.pan = { startScreen: { x: event.clientX, y: event.clientY }, origin: { x: this.editor.viewport.x, y: this.editor.viewport.y } };
      return;
    }
    this.editor.lastSnap = null;
    this.safe(() => this.editor.activeTool.pointerDown(this.editor, input));
    this.editor.draw();
  };

  private onMove = (event: PointerEvent): void => {
    const input = this.input(event);
    if (this.pan) {
      this.editor.viewport.x = this.pan.origin.x + event.clientX - this.pan.startScreen.x;
      this.editor.viewport.y = this.pan.origin.y + event.clientY - this.pan.startScreen.y;
      this.editor.draw();
      return;
    }
    this.editor.lastSnap = null;
    this.editor.hoverId = hitTest(this.editor.scene, input.rawWorld, this.editor.viewport.scale);
    this.safe(() => this.editor.activeTool.pointerMove?.(this.editor, input));
    this.editor.draw();
  };

  private onUp = (event: PointerEvent): void => {
    if (this.pan) {
      this.pan = null;
      this.editor.draw();
      return;
    }
    this.safe(() => this.editor.activeTool.pointerUp?.(this.editor, this.input(event)));
    this.editor.draw();
  };

  private onCancel = (): void => {
    if (this.pan) {
      this.pan = null;
      this.editor.draw();
      return;
    }
    this.safe(() => this.editor.activeTool.pointerCancel?.(this.editor));
    this.editor.draw();
  };

  private onDbl = (event: MouseEvent): void => {
    if (this.pan) return;
    const rect = this.getRect();
    const rawWorld = this.editor.viewport.toWorld(event.clientX, event.clientY, rect);
    this.safe(() =>
      this.editor.activeTool.dblClick?.(this.editor, {
        client: { x: event.clientX, y: event.clientY },
        rawWorld,
        button: 0,
        shift: event.shiftKey,
        alt: event.altKey,
        ctrl: event.ctrlKey || event.metaKey,
      }),
    );
    this.editor.draw();
  };

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      console.error('[math-painter] tool error', error);
      this.editor.setStatus('TOOL ERROR');
    }
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.getRect();
    const mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.editor.viewport.zoomAt(mouse, event.deltaY < 0 ? 1.1 : 0.9);
    this.editor.draw();
  };

  private onKey = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key.toLowerCase();
    if (key === ' ') {
      this.spaceDown = true;
      event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'z') {
      event.preventDefault();
      this.editor.redo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      this.editor.undo();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // All single-key bindings are in the left half of the keyboard so the
    // left hand can drive them while the right hand stays on the mouse.
    if (key === 'v') this.editor.setTool('select');
    else if (key === 'd') this.editor.setTool('point');
    else if (key === 's') this.editor.setTool('segment');
    else if (key === 'c') this.editor.setTool('circle');
    else if (key === 'b') this.choosePolygon();
    else if (key === 'a') this.editor.setTool('arc');
    else if (key === 'g') this.editor.setTool('angle');
    else if (key === 't') this.editor.setTool('tick');
    else if (key === 'w') this.editor.setTool('label');
    else if (key === 'escape') {
      this.editor.activeTool.cancel?.(this.editor);
      this.editor.setStatus('CANCEL');
    } else if (key === 'backspace' || key === 'x') {
      this.editor.deleteSelected();
    } else if (key === 'z') {
      this.editor.undo();
    } else if (key === 'r') {
      this.editor.redo();
    } else if (key === 'e') {
      this.editor.exportScene();
    } else if (key === 'q') {
      this.fileInput.click();
    } else if (key === '1') {
      this.editor.toggleHidden();
    } else if (this.pluginKeys.has(key)) {
      const id = this.pluginKeys.get(key)!;
      if (this.editor.tools.get(id)) this.editor.setTool(id);
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === ' ') this.spaceDown = false;
  };

  /** Register a plugin shortcut: a single key mapped to a (registered) tool id.
   *  Built-in bindings take precedence, so a plugin key only fires when no
   *  built-in action claims that key. */
  bindPluginKey(key: string, toolId: string): void {
    this.pluginKeys.set(key.toLowerCase(), toolId);
  }

  /** Pressing G offers a choice between a regular and a free polygon. The
   *  selected mode is stored on the (persistent) PolygonTool instance, then the
   *  polygon tool is activated. */
  choosePolygon(): void {
    void this.editor.promptChoice('多边形类型', [
      { key: '1', label: '正多边形 (regular)' },
      { key: '2', label: '普通多边形 (free)' },
    ]).then((choice) => {
      if (!choice) {
        this.editor.setStatus('CANCEL');
        return;
      }
      const poly = this.editor.tools.get('polygon');
      if (poly) (poly as PolygonTool).mode = choice === '1' ? 'regular' : 'free';
      this.editor.setTool('polygon');
    });
  }
}
