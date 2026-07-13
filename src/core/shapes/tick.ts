import type { TickShape, Vec } from '../types';
import { registerShape } from './registry';
import { distToSegment, normalizeVec, sub, midpoint, projectOnSegment } from '../geometry';
import { isRecord, parseVec, isFiniteNumber, strokeAttr } from '../parse';
import { TICK_LEN_PX, TICK_GAP_PX, MAX_TICK } from '../constants';

registerShape<TickShape>({
  type: 'tick',
  anchors: (shape) => [midpoint(shape.a, shape.b)],
  hit: (shape, world, tolerance) => distToSegment(world, shape.a, shape.b) < tolerance,
  draw: (ctx, shape, opts) => {
    const u = normalizeVec(sub(shape.b, shape.a));
    const perp: Vec = { x: -u.y, y: u.x };
    const len = TICK_LEN_PX / opts.scale;
    const gap = TICK_GAP_PX / opts.scale;
    const mid = midpoint(shape.a, shape.b);
    const start = -((shape.count - 1) / 2) * gap;
    ctx.strokeStyle = shape.style.stroke;
    ctx.lineWidth = (opts.active ? 2.5 : 1.5) / opts.scale;
    ctx.beginPath();
    for (let i = 0; i < shape.count; i++) {
      const c = { x: mid.x + u.x * (start + i * gap), y: mid.y + u.y * (start + i * gap) };
      ctx.moveTo(c.x + perp.x * (len / 2), c.y + perp.y * (len / 2));
      ctx.lineTo(c.x - perp.x * (len / 2), c.y - perp.y * (len / 2));
    }
    ctx.stroke();
  },
  translate: (shape, delta) => ({ ...shape, a: { x: shape.a.x + delta.x, y: shape.a.y + delta.y }, b: { x: shape.b.x + delta.x, y: shape.b.y + delta.y } }),
  nearest: (shape, world) => {
    const point = projectOnSegment(world, shape.a, shape.b);
    return { point, dist: Math.hypot(world.x - point.x, world.y - point.y) };
  },
  bbox: (shape) => [shape.a, shape.b],
  toSVG: (shape, { ink }) => {
    const u = normalizeVec(sub(shape.b, shape.a));
    const perp: Vec = { x: -u.y, y: u.x };
    const m = midpoint(shape.a, shape.b);
    const start = -((shape.count - 1) / 2) * TICK_GAP_PX;
    const stroke = strokeAttr(shape.style, ink);
    let lines = '';
    for (let i = 0; i < shape.count; i++) {
      const c = { x: m.x + u.x * (start + i * TICK_GAP_PX), y: m.y + u.y * (start + i * TICK_GAP_PX) };
      lines += `<line x1="${c.x + perp.x * (TICK_LEN_PX / 2)}" y1="${c.y + perp.y * (TICK_LEN_PX / 2)}" x2="${c.x - perp.x * (TICK_LEN_PX / 2)}" y2="${c.y - perp.y * (TICK_LEN_PX / 2)}" ${stroke}/>`;
    }
    return lines;
  },
  parse: (value, id, style) => {
    if (!isRecord(value) || value.type !== 'tick') return null;
    const a = parseVec(value.a);
    const b = parseVec(value.b);
    if (!a || !b || !isFiniteNumber(value.count) || value.count < 1 || value.count > MAX_TICK) return null;
    return { id, type: 'tick', a, b, count: Math.floor(value.count), style };
  },
});
