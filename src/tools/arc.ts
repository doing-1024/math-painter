import type { EditorContext, Tool, PointerInput } from './types';
import type { Vec } from '../core/types';
import type { Overlay } from '../render/renderer';
import { dist, normalizeAngle, radToDeg, snapToStep, MIN_RADIUS } from '../core/geometry';
import { DEFAULT_STYLE } from '../core/style';

/** Angle snap step in radians (15deg -> includes 45, 90, ...). */
const ANGLE_SNAP = (15 * Math.PI) / 180;

export class ArcTool implements Tool {
  id = 'arc';
  cursor = 'crosshair';
  private center: Vec | null = null;
  private start: Vec | null = null;
  private radius = 0;
  private unwrapped = 0;
  private lastAngle: number | null = null;
  private sweep = 0;
  private preview: Vec | null = null;

  activate(): void {
    this.center = null;
    this.start = null;
    this.radius = 0;
    this.unwrapped = 0;
    this.lastAngle = null;
    this.sweep = 0;
    this.preview = null;
  }

  /** Track the cursor's actual dragging direction. We keep a continuous
   *  (unwrapped) cursor angle so the arc follows exactly what the user drags:
   *  short way -> minor arc, long way -> major arc. The snapped value used for
   *  display/commit is derived fresh each frame from (unwrapped - a0), never
   *  accumulated into, so it stays accurate and flexible. */
  private accumulate(rawWorld: Vec, ctx: EditorContext): void {
    if (!this.center || !this.start) return;
    const angle = Math.atan2(rawWorld.y - this.center.y, rawWorld.x - this.center.x);
    if (this.lastAngle !== null) {
      this.unwrapped += normalizeAngle(angle - this.lastAngle);
    }
    this.lastAngle = angle;
    const a0 = Math.atan2(this.start.y - this.center.y, this.start.x - this.center.x);
    this.sweep = snapToStep(this.unwrapped - a0, ANGLE_SNAP);
    const target = a0 + this.sweep;
    this.preview = { x: this.center.x + this.radius * Math.cos(target), y: this.center.y + this.radius * Math.sin(target) };
    ctx.setStatusText(`ARC: ${Math.round(Math.abs(radToDeg(this.sweep)))}°`);
  }

  pointerDown(ctx: EditorContext, e: PointerInput): void {
    if (!this.center) {
      this.center = ctx.snap(e.rawWorld);
      this.preview = null;
      ctx.draw();
      return;
    }
    if (!this.start) {
      const first = ctx.snap(e.rawWorld);
      const r = dist(this.center, first);
      if (r < MIN_RADIUS) return; // too close to center, ignore
      this.start = first;
      this.radius = r;
      const a0 = Math.atan2(this.start.y - this.center.y, this.start.x - this.center.x);
      this.unwrapped = a0;
      this.lastAngle = a0;
      this.sweep = 0;
      this.preview = first;
      ctx.setStatusText('ARC: 0°');
      ctx.draw();
      return;
    }
    this.accumulate(ctx.snap(e.rawWorld), ctx);
    if (this.sweep === 0) return; // degenerate, ignore
    const a0 = Math.atan2(this.start.y - this.center.y, this.start.x - this.center.x);
    const a1 = a0 + this.sweep;
    const c = this.center;
    const r = this.radius;
    this.center = null;
    this.start = null;
    this.radius = 0;
    this.unwrapped = 0;
    this.lastAngle = null;
    this.sweep = 0;
    this.preview = null;
    ctx.add({ id: ctx.idgen.next(), type: 'arc', c, r, a0, a1, style: { ...DEFAULT_STYLE } });
  }

  pointerMove(ctx: EditorContext, e: PointerInput): void {
    if (this.center && !this.start) {
      this.preview = ctx.snap(e.rawWorld);
      ctx.draw();
    } else if (this.center && this.start) {
      this.accumulate(ctx.snap(e.rawWorld), ctx);
      ctx.draw();
    }
  }

  cancel(ctx: EditorContext): void {
    this.center = null;
    this.start = null;
    this.radius = 0;
    this.unwrapped = 0;
    this.lastAngle = null;
    this.sweep = 0;
    this.preview = null;
    ctx.draw();
  }

  drawOverlay(o: Overlay): void {
    if (this.center && !this.start && this.preview) {
      o.drawDashedCircle(this.center, dist(this.center, this.preview));
      o.drawAnchor(this.center, false);
      o.drawAnchor(this.preview, false);
    } else if (this.center && this.start && this.preview) {
      const a0 = Math.atan2(this.start.y - this.center.y, this.start.x - this.center.x);
      const a1 = a0 + this.sweep;
      o.drawDashedSegment(this.center, this.start);
      o.drawDashedSegment(this.center, this.preview);
      o.drawDashedArc(this.center, this.radius, a0, a1);
      o.drawAnchor(this.center, false);
      o.drawAnchor(this.start, false);
      o.drawAnchor(this.preview, false);
      const mid = a0 + this.sweep / 2;
      const label = { x: this.center.x + this.radius * 0.7 * Math.cos(mid), y: this.center.y + this.radius * 0.7 * Math.sin(mid) };
      o.drawText(`${Math.round(Math.abs(radToDeg(this.sweep)))}°`, label);
    } else if (this.center) {
      o.drawAnchor(this.center, false);
    }
  }
}
