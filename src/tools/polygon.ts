import type { EditorContext, Tool, PointerInput } from './types';
import type { Vec } from '../core/types';
import type { Overlay } from '../render/renderer';
import { pointsEqual, regularPolygon, MIN_RADIUS } from '../core/geometry';
import { DEFAULT_STYLE } from '../core/style';

type PolyMode = 'free' | 'regular';

export class PolygonTool implements Tool {
  id = 'polygon';
  cursor = 'crosshair';
  mode: PolyMode = 'free';

  // free-mode state
  private points: Vec[] = [];
  private preview: Vec | null = null;

  // regular-mode state (first edge v0 -> v1; then ask for side count)
  private edge0: Vec | null = null;
  private edge1: Vec | null = null;
  private mouse: Vec | null = null;

  activate(): void {
    this.reset();
  }

  private reset(): void {
    this.points = [];
    this.preview = null;
    this.edge0 = null;
    this.edge1 = null;
    this.mouse = null;
  }

  pointerDown(ctx: EditorContext, e: PointerInput): void {
    if (this.mode === 'regular') return this.regularDown(ctx, e);
    const point = ctx.snap(e.rawWorld, this.points);
    const first = this.points[0];
    if (first && this.points.length >= 3 && pointsEqual(point, first)) {
      this.commit(ctx);
      return;
    }
    this.points.push(point);
    this.preview = point;
    ctx.draw();
  }

  pointerMove(ctx: EditorContext, e: PointerInput): void {
    if (this.mode === 'regular') return this.regularMove(ctx, e);
    if (this.points.length) {
      this.preview = ctx.snap(e.rawWorld, this.points);
      ctx.draw();
    }
  }

  dblClick(ctx: EditorContext): void {
    if (this.mode === 'free' && this.points.length >= 3) this.commit(ctx);
  }

  cancel(ctx: EditorContext): void {
    this.reset();
    ctx.draw();
  }

  private commit(ctx: EditorContext): void {
    const pts = [...this.points];
    this.reset();
    ctx.add({ id: ctx.idgen.next(), type: 'polygon', points: pts, style: { ...DEFAULT_STYLE } });
  }

  // ---- regular polygon ----
  private regularDown(ctx: EditorContext, e: PointerInput): void {
    const p = ctx.snap(e.rawWorld, []);
    if (!this.edge0) {
      this.edge0 = p;
      this.edge1 = null;
      this.mouse = p;
      ctx.setStatusText('REGULAR: click second point (first edge)');
      ctx.draw();
      return;
    }
    if (!this.edge1) {
      this.edge1 = p;
      this.mouse = p;
      ctx.setStatusText('REGULAR: enter side count n');
      ctx.draw();
      void this.askSides(ctx);
    }
  }

  private regularMove(ctx: EditorContext, e: PointerInput): void {
    this.mouse = ctx.snap(e.rawWorld, []);
    ctx.draw();
  }

  private async askSides(ctx: EditorContext): Promise<void> {
    const v0 = this.edge0;
    const v1 = this.edge1;
    if (!v0 || !v1) {
      this.reset();
      ctx.setStatus('CANCEL');
      ctx.draw();
      return;
    }
    const answer = await ctx.promptText('正多边形边数 n (>=3)', '6');
    this.reset();
    if (answer === null) {
      ctx.setStatus('CANCEL');
      ctx.draw();
      return;
    }
    const n = Math.floor(Number(answer));
    if (!Number.isFinite(n) || n < 3) {
      ctx.setStatus('边数无效');
      ctx.draw();
      return;
    }
    if (Math.hypot(v1.x - v0.x, v1.y - v0.y) < MIN_RADIUS) {
      ctx.setStatus('边太短');
      ctx.draw();
      return;
    }
    const pts = regularPolygon(v0, v1, n);
    ctx.add({ id: ctx.idgen.next(), type: 'polygon', points: pts, style: { ...DEFAULT_STYLE } });
    ctx.setStatus(`REGULAR n=${n}`);
  }

  drawOverlay(o: Overlay): void {
    if (this.mode === 'regular') {
      if (this.edge0 && this.edge1) {
        o.drawDashedSegment(this.edge0, this.edge1);
        o.drawAnchor(this.edge0, false);
        o.drawAnchor(this.edge1, false);
      } else if (this.edge0 && this.mouse) {
        o.drawDashedSegment(this.edge0, this.mouse);
        o.drawAnchor(this.edge0, false);
        o.drawAnchor(this.mouse, false);
      }
      return;
    }
    if (this.points.length) {
      o.drawDashedPolygon([...this.points, ...(this.preview ? [this.preview] : [])]);
      for (const point of this.points) o.drawAnchor(point, false);
      if (this.preview) o.drawAnchor(this.preview, false);
    }
  }
}
