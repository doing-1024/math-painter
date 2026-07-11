import type { EditorContext, Tool, PointerInput } from './types';
import type { Shape, Vec } from '../core/types';
import { dist } from '../core/geometry';
import { cloneShape } from '../core/util';
import { hitTest, translateShape } from '../core/shapes/registry';

type Drag =
  | { kind: 'move'; startWorld: Vec; startScreen: Vec; original: Map<string, Shape>; moved: boolean }
  | { kind: 'pan'; startScreen: Vec; origin: Vec };

export class SelectTool implements Tool {
  id = 'select';
  cursor = 'default';
  private drag: Drag | null = null;

  pointerDown(ctx: EditorContext, e: PointerInput): void {
    if (e.button !== 0) return;
    const id = hitTest(ctx.scene, e.rawWorld, ctx.viewport.scale);
    if (id) {
      if (!e.shift) ctx.selection.set([id]);
      else ctx.selection.toggle(id);
      if (ctx.selection.has(id)) {
        this.drag = {
          kind: 'move',
          startWorld: e.rawWorld,
          startScreen: e.client,
          original: new Map([...ctx.selection.list()].map((shapeId) => [shapeId, cloneShape(ctx.scene.shapes[shapeId])])),
          moved: false,
        };
      }
    } else {
      if (!e.shift) ctx.selection.clear();
      this.drag = { kind: 'pan', startScreen: e.client, origin: { x: ctx.viewport.x, y: ctx.viewport.y } };
    }
    ctx.draw();
  }

  pointerMove(ctx: EditorContext, e: PointerInput): void {
    if (!this.drag) return;
    if (this.drag.kind === 'pan') {
      ctx.viewport.x = this.drag.origin.x + e.client.x - this.drag.startScreen.x;
      ctx.viewport.y = this.drag.origin.y + e.client.y - this.drag.startScreen.y;
      ctx.draw();
      return;
    }
    if (!this.drag.moved && dist(e.client, this.drag.startScreen) < 4) return;
    this.drag.moved = true;
    // snap the grabbed point to nearby anchors/edges (excluding the shapes
    // being dragged, so they can't stick to themselves)
    const cursor = ctx.snap(e.rawWorld, [], ctx.selection.list());
    const delta = { x: cursor.x - this.drag.startWorld.x, y: cursor.y - this.drag.startWorld.y };
    for (const [id, shape] of this.drag.original) ctx.scene.shapes[id] = translateShape(shape, delta);
    ctx.draw();
  }

  pointerUp(ctx: EditorContext): void {
    if (this.drag?.kind === 'move' && this.drag.moved) {
      const after = new Map([...this.drag.original.keys()].map((id) => [id, cloneShape(ctx.scene.shapes[id])]));
      ctx.replace(this.drag.original, after);
    }
    this.drag = null;
    ctx.draw();
  }

  pointerCancel(ctx: EditorContext): void {
    this.drag = null;
    ctx.draw();
  }
}
