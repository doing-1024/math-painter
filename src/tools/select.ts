import type { EditorContext, Tool, PointerInput } from './types';
import type { Overlay } from '../render/renderer';
import type { Shape, Vec } from '../core/types';
import { dist } from '../core/geometry';
import { cloneShape } from '../core/util';
import { hitTest, translateShape } from '../core/shapes/registry';
import { boxSelectionIds, normalizeRect } from '../core/select-box';

type Drag =
  | { kind: 'move'; startWorld: Vec; startScreen: Vec; original: Map<string, Shape>; moved: boolean }
  | { kind: 'box'; start: Vec; current: Vec | null; additive: boolean; base: Set<string> };

export class SelectTool implements Tool {
  id = 'select';
  cursor = 'default';
  private drag: Drag | null = null;

  pointerDown(ctx: EditorContext, e: PointerInput): void {
    if (e.button !== 0) return;
    const additive = e.ctrl || e.shift;
    const id = hitTest(ctx.scene, e.rawWorld, ctx.viewport.scale);
    if (id) {
      if (additive) {
        ctx.selection.toggle(id);
      } else if (!ctx.selection.has(id)) {
        ctx.selection.set([id]);
      }
      if (ctx.selection.has(id)) this.startMove(ctx, e);
    } else {
      // Empty canvas: rubber-band selection. Plain drag replaces the selection;
      // ctrl/shift drag adds to the current selection.
      const base = additive ? new Set(ctx.selection.list()) : new Set<string>();
      this.drag = { kind: 'box', start: e.rawWorld, current: null, additive, base };
    }
    ctx.draw();
  }

  private startMove(ctx: EditorContext, e: PointerInput): void {
    const original = new Map([...ctx.selection.list()].map((id) => [id, cloneShape(ctx.scene.shapes[id])]));
    this.drag = { kind: 'move', startWorld: e.rawWorld, startScreen: e.client, original, moved: false };
  }

  pointerMove(ctx: EditorContext, e: PointerInput): void {
    if (!this.drag) return;
    if (this.drag.kind === 'move') {
      if (!this.drag.moved && dist(e.client, this.drag.startScreen) < 4) return;
      this.drag.moved = true;
      // Snap the grabbed point to nearby anchors/edges, excluding the shapes
      // being dragged so they cannot stick to themselves.
      const cursor = ctx.snap(e.rawWorld, [], ctx.selection.list());
      const delta = { x: cursor.x - this.drag.startWorld.x, y: cursor.y - this.drag.startWorld.y };
      for (const [id, shape] of this.drag.original) ctx.scene.shapes[id] = translateShape(shape, delta);
      ctx.draw();
      return;
    }
    // Rubber-band selection: show the box and update the selection live.
    this.drag.current = e.rawWorld;
    const ids = boxSelectionIds(ctx.scene, normalizeRect(this.drag.start, e.rawWorld));
    ctx.selection.set([...new Set([...this.drag.base, ...ids])]);
    ctx.setStatusText(`SELECT: ${ctx.selection.list().length}`);
    ctx.draw();
  }

  pointerUp(ctx: EditorContext): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    if (drag.kind === 'box') {
      const moved = drag.current !== null && (drag.current.x !== drag.start.x || drag.current.y !== drag.start.y);
      // A plain click on empty canvas clears the selection; ctrl/shift click
      // keeps the base selection.
      if (!drag.additive && !moved) ctx.selection.clear();
      ctx.setStatus(`SELECT ${ctx.selection.list().length}`);
      ctx.draw();
      return;
    }
    if (drag.moved) {
      const after = new Map([...drag.original.keys()].map((id) => [id, cloneShape(ctx.scene.shapes[id])]));
      ctx.replace(drag.original, after);
    }
    ctx.draw();
  }

  pointerCancel(ctx: EditorContext): void {
    this.drag = null;
    ctx.draw();
  }

  drawOverlay(overlay: Overlay): void {
    const drag = this.drag;
    if (drag?.kind === 'box' && drag.current) {
      overlay.drawRect(drag.start.x, drag.start.y, drag.current.x, drag.current.y);
    }
  }
}
