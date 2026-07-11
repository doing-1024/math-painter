import type { EditorContext, Tool, PointerInput } from './types';
import type { PointShape } from '../core/types';
import { DEFAULT_STYLE } from '../core/style';

export class PointTool implements Tool {
  id = 'point';
  cursor = 'crosshair';

  async pointerDown(ctx: EditorContext, e: PointerInput): Promise<void> {
    const point = ctx.snap(e.rawWorld);
    const id = ctx.idgen.next();
    // place the point immediately so a click always creates it; the prompt
    // only attaches an optional label afterwards.
    const created: PointShape = { id, type: 'point', p: point, style: { ...DEFAULT_STYLE } };
    ctx.add(created);
    const label = await ctx.promptText('point label (optional):', '');
    if (label) {
      const current = ctx.scene.shapes[id];
      if (current && current.type === 'point') {
        ctx.replace(new Map([[id, current]]), new Map([[id, { ...current, label }]]));
      }
    }
  }
}
