import type { EditorContext, Tool, PointerInput } from './types';
import type { Vec } from '../core/types';
import type { Overlay } from '../render/renderer';
import { DEFAULT_STYLE } from '../core/style';

export class SegmentTool implements Tool {
  id = 'segment';
  cursor = 'crosshair';
  private start: Vec | null = null;
  private preview: Vec | null = null;

  activate(): void {
    this.start = null;
    this.preview = null;
  }

  pointerDown(ctx: EditorContext, e: PointerInput): void {
    if (!this.start) {
      this.start = ctx.snap(e.rawWorld);
      this.preview = this.start;
      ctx.draw();
      return;
    }
    const end = ctx.snap(e.rawWorld);
    const begin = this.start;
    this.start = null;
    this.preview = null;
    ctx.add({ id: ctx.idgen.next(), type: 'segment', a: begin, b: end, style: { ...DEFAULT_STYLE } });
  }

  pointerMove(ctx: EditorContext, e: PointerInput): void {
    if (this.start) {
      this.preview = ctx.snap(e.rawWorld);
      ctx.draw();
    }
  }

  cancel(ctx: EditorContext): void {
    this.start = null;
    this.preview = null;
    ctx.draw();
  }

  drawOverlay(o: Overlay): void {
    if (this.start && this.preview) {
      o.drawDashedSegment(this.start, this.preview);
      o.drawAnchor(this.start, false);
      o.drawAnchor(this.preview, false);
    }
  }
}
