import type { EditorContext, Tool, PointerInput } from './types';
import type { TickShape, Vec } from '../core/types';
import type { Overlay } from '../render/renderer';
import { hitTest, shapeEdgeAt } from '../core/shapes/registry';
import { pointsEqual } from '../core/geometry';
import { cloneShape } from '../core/util';
import { DEFAULT_STYLE } from '../core/style';

const MAX_TICK = 8;

export class TickTool implements Tool {
  id = 'tick';
  cursor = 'crosshair';
  private mouse: Vec | null = null;

  activate(): void {
    this.mouse = null;
  }

  pointerMove(ctx: EditorContext, e: PointerInput): void {
    this.mouse = ctx.snap(e.rawWorld);
  }

  async pointerDown(ctx: EditorContext, e: PointerInput): Promise<void> {
    const at = ctx.snap(e.rawWorld);
    const id = hitTest(ctx.scene, at, ctx.viewport.scale);
    const shape = id ? ctx.scene.shapes[id] : null;
    // Polygon edges behave like ordinary segments: resolve the clicked edge.
    const edge = shape ? shapeEdgeAt(shape, at) : null;
    if (!edge) {
      ctx.setStatus('TICK: click a segment / polygon edge');
      return;
    }
    const a = { ...edge.a };
    const b = { ...edge.b };
    const existingId = this.findTick(ctx, a, b);
    const defaultValue = existingId ? String((ctx.scene.shapes[existingId] as TickShape).count) : '1';
    const answer = await ctx.promptText('tick count (>=1):', defaultValue);
    if (answer === null) {
      ctx.setStatus('CANCEL');
      return;
    }
    let count = Math.floor(Number(answer));
    if (!Number.isFinite(count) || count < 1) {
      ctx.setStatus('TICK: invalid count');
      return;
    }
    count = Math.min(count, MAX_TICK);
    if (existingId) {
      const cur = ctx.scene.shapes[existingId];
      const before = new Map([[existingId, cloneShape(cur)]]);
      const after = new Map([[existingId, { ...cloneShape(cur), a, b, count }]]);
      ctx.replace(before, after);
    } else {
      ctx.add({ id: ctx.idgen.next(), type: 'tick', a, b, count, style: { ...DEFAULT_STYLE } });
    }
    ctx.setStatus(`TICK: ${count}`);
  }

  private findTick(ctx: EditorContext, a: Vec, b: Vec): string | null {
    for (const id of ctx.scene.order) {
      const shape = ctx.scene.shapes[id];
      if (shape && shape.type === 'tick') {
        const m = shape as TickShape;
        if ((pointsEqual(m.a, a) && pointsEqual(m.b, b)) || (pointsEqual(m.a, b) && pointsEqual(m.b, a))) return id;
      }
    }
    return null;
  }

  drawOverlay(o: Overlay): void {
    if (this.mouse) o.drawAnchor(this.mouse, false);
  }
}
