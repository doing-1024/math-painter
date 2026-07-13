import type { PointShape } from '../types';
import { registerShape } from './registry';
import { dist } from '../geometry';
import { isRecord, parseVec, esc } from '../parse';
import { GLYPH_FONT_PX, POINT_RADIUS_PX } from '../constants';

registerShape<PointShape>({
  type: 'point',
  anchors: (shape) => [shape.p],
  hit: (shape, world, tolerance) => dist(world, shape.p) < tolerance,
  draw: (ctx, shape, opts) => {
    ctx.strokeStyle = shape.style.stroke;
    ctx.fillStyle = shape.style.fill;
    ctx.lineWidth = (opts.active ? 2.5 : 1.5) / opts.scale;
    ctx.beginPath();
    ctx.arc(shape.p.x, shape.p.y, POINT_RADIUS_PX / opts.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (shape.label) {
      ctx.fillStyle = shape.style.stroke;
      ctx.font = `${GLYPH_FONT_PX / opts.scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(shape.label, shape.p.x + 8 / opts.scale, shape.p.y - 8 / opts.scale);
    }
  },
  translate: (shape, delta) => ({ ...shape, p: { x: shape.p.x + delta.x, y: shape.p.y + delta.y } }),
  nearest: (shape, world) => ({ point: shape.p, dist: dist(world, shape.p) }),
  bbox: (shape) => [shape.p, { x: shape.p.x + 6, y: shape.p.y - 6 }],
  toSVG: (shape, { ink }) => {
    const t = shape.label
      ? `<text x="${shape.p.x + 6}" y="${shape.p.y - 6}" font-family="monospace" font-size="${GLYPH_FONT_PX}" fill="${ink}" text-anchor="start">${esc(shape.label)}</text>`
      : '';
    return `<circle cx="${shape.p.x}" cy="${shape.p.y}" r="${POINT_RADIUS_PX}" fill="${ink}"/>${t}`;
  },
  parse: (value, id, style) => {
    if (!isRecord(value) || value.type !== 'point') return null;
    const p = parseVec(value.p);
    if (!p) return null;
    const label = typeof value.label === 'string' ? value.label : undefined;
    return { id, type: 'point', p, style, ...(label ? { label } : {}) };
  },
});
