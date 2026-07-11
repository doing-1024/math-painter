import type { EditorContext, Tool, PointerInput } from './types';
import type { LabelShape, Vec } from '../core/types';
import type { Overlay } from '../render/renderer';
import { DEFAULT_STYLE } from '../core/style';

export class LabelTool implements Tool {
  id = 'label';
  cursor = 'text';
  private mouse: Vec | null = null;

  activate(): void {
    this.mouse = null;
  }

  pointerMove(ctx: EditorContext, e: PointerInput): void {
    this.mouse = ctx.snap(e.rawWorld);
  }

  async pointerDown(ctx: EditorContext, e: PointerInput): Promise<void> {
    const at = ctx.snap(e.rawWorld);
    const text = await ctx.promptText('label:', '');
    if (text === null || text.trim() === '') {
      ctx.setStatus('LABEL: cancelled');
      return;
    }
    const created: LabelShape = { id: ctx.idgen.next(), type: 'label', text, at, style: { ...DEFAULT_STYLE } };
    ctx.add(created);
    ctx.setStatus(`LABEL: ${text}`);
  }

  drawOverlay(o: Overlay): void {
    if (this.mouse) o.drawAnchor(this.mouse, false);
  }
}
