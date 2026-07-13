import type { CircleShape } from '../types';
import { registerShape } from './registry';
import { dist } from '../geometry';
import { isRecord, parseVec, isFiniteNumber, strokeAttr } from '../parse';

registerShape<CircleShape>({
  type: 'circle',
  anchors: (shape) => [shape.c],
  hit: (shape, world, tolerance) => {
    // The rim band selects the circle, and the interior does too (so a click
    // inside the disc is selectable / measurable, like a polygon's interior).
    const d = dist(world, shape.c);
    return d < shape.r || Math.abs(d - shape.r) < tolerance;
  },
  draw: (ctx, shape, opts) => {
    ctx.strokeStyle = shape.style.stroke;
    ctx.lineWidth = (opts.active ? 2.5 : 1.5) / opts.scale;
    ctx.beginPath();
    ctx.arc(shape.c.x, shape.c.y, shape.r, 0, Math.PI * 2);
    ctx.stroke();
  },
  translate: (shape, delta) => ({ ...shape, c: { x: shape.c.x + delta.x, y: shape.c.y + delta.y } }),
  nearest: (shape, world) => {
    const d = dist(world, shape.c);
    const f = d < 1e-9 ? 0 : 1;
    const point = { x: shape.c.x + (f * (world.x - shape.c.x) * shape.r) / d, y: shape.c.y + (f * (world.y - shape.c.y) * shape.r) / d };
    return { point, dist: Math.abs(d - shape.r) };
  },
  bbox: (shape) => [
    shape.c,
    { x: shape.c.x + shape.r, y: shape.c.y },
    { x: shape.c.x - shape.r, y: shape.c.y },
    { x: shape.c.x, y: shape.c.y + shape.r },
    { x: shape.c.x, y: shape.c.y - shape.r },
  ],
  toSVG: (shape, { ink }) => `<circle cx="${shape.c.x}" cy="${shape.c.y}" r="${shape.r}" ${strokeAttr(shape.style, ink)}/>`,
  parse: (value, id, style) => {
    if (!isRecord(value) || value.type !== 'circle') return null;
    const c = parseVec(value.c);
    if (!c || !isFiniteNumber(value.r) || value.r < 0) return null;
    return { id, type: 'circle', c, r: value.r, style };
  },
});
