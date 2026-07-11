import type { EditorContext, Tool, PointerInput } from './types';
import type { Vec } from '../core/types';
import type { Overlay } from '../render/renderer';
import { dist, MIN_RADIUS } from '../core/geometry';
import { DEFAULT_STYLE } from '../core/style';

export class CircleTool implements Tool {
  id = 'circle';
  cursor = 'crosshair';
  private center: Vec | null = null;
  private preview: Vec | null = null;

  activate(): void {
    this.center = null;
    this.preview = null;
  }

  pointerDown(ctx: EditorContext, e: PointerInput): void {
    if (!this.center) {
      this.center = ctx.snap(e.rawWorld);
      this.preview = this.center;
      ctx.draw();
      return;
    }
    const edge = ctx.snap(e.rawWorld);
    const r = dist(this.center, edge);
    const c = this.center;
    this.center = null;
    this.preview = null;
    if (r < MIN_RADIUS) return; // degenerate circle, ignore
    ctx.add({ id: ctx.idgen.next(), type: 'circle', c, r, style: { ...DEFAULT_STYLE } });
  }

  pointerMove(ctx: EditorContext, e: PointerInput): void {
    if (this.center) {
      this.preview = ctx.snap(e.rawWorld);
      ctx.draw();
    }
  }

  cancel(ctx: EditorContext): void {
    this.center = null;
    this.preview = null;
    ctx.draw();
  }

  drawOverlay(o: Overlay): void {
    if (this.center && this.preview) {
      o.drawDashedCircle(this.center, dist(this.center, this.preview));
      o.drawAnchor(this.center, false);
      o.drawAnchor(this.preview, false);
    }
  }
}
