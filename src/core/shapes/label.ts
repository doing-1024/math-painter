import type { LabelShape } from '../types';
import { registerShape } from './registry';
import { dist } from '../geometry';
import { isRecord, parseVec, esc } from '../parse';
import { GLYPH_FONT_PX } from '../constants';

registerShape<LabelShape>({
  type: 'label',
  // No structural anchor: the label's anchor coincides with its text, so
  // drawing one would obscure the text. Selection is shown by the text color.
  anchors: () => [],
  hit: (shape, world, tolerance) => dist(world, shape.at) < tolerance * 2,
  draw: (ctx, shape, opts) => {
    ctx.fillStyle = shape.style.stroke;
    ctx.font = `${GLYPH_FONT_PX / opts.scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shape.text, shape.at.x, shape.at.y);
  },
  translate: (shape, delta) => ({ ...shape, at: { x: shape.at.x + delta.x, y: shape.at.y + delta.y } }),
  nearest: (shape, world) => ({ point: shape.at, dist: dist(world, shape.at) }),
  bbox: (shape) => [shape.at],
  toSVG: (shape, { ink }) =>
    `<text x="${shape.at.x}" y="${shape.at.y}" font-family="monospace" font-size="${GLYPH_FONT_PX}" fill="${ink}" text-anchor="middle">${esc(shape.text)}</text>`,
  parse: (value, id, style) => {
    // Legacy 'measure' shapes are accepted and treated as free labels.
    if (!isRecord(value) || (value.type !== 'label' && value.type !== 'measure')) return null;
    const at = parseVec(value.at);
    if (!at || typeof value.text !== 'string') return null;
    return { id, type: 'label', text: value.text, at, style };
  },
});
