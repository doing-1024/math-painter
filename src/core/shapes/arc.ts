import type { ArcShape, Vec } from '../types';
import { registerShape } from './registry';
import { distToSegment, normalizeAngle } from '../geometry';
import { isRecord, parseVec, isFiniteNumber, strokeAttr } from '../parse';
import { ARC_SAMPLES } from '../constants';

const SAMPLES = ARC_SAMPLES;

function pointOnArc(c: Vec, r: number, angle: number): Vec {
  return { x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) };
}

export function arcEndpoints(shape: ArcShape): { start: Vec; end: Vec } {
  return {
    start: pointOnArc(shape.c, shape.r, shape.a0),
    end: pointOnArc(shape.c, shape.r, shape.a1),
  };
}

registerShape<ArcShape>({
  type: 'arc',
  anchors: (shape) => {
    const { start, end } = arcEndpoints(shape);
    return [shape.c, start, end];
  },
  hit: (shape, world, tolerance) => {
    let previous = pointOnArc(shape.c, shape.r, shape.a0);
    for (let i = 1; i <= SAMPLES; i++) {
      const angle = shape.a0 + (shape.a1 - shape.a0) * (i / SAMPLES);
      const current = pointOnArc(shape.c, shape.r, angle);
      if (distToSegment(world, previous, current) < tolerance) return true;
      previous = current;
    }
    return false;
  },
  draw: (ctx, shape, opts) => {
    const sweep = shape.a1 - shape.a0;
    if (opts.active) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / opts.scale;
      ctx.beginPath();
      ctx.arc(shape.c.x, shape.c.y, shape.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = opts.active ? '#ffffff' : shape.style.stroke;
    ctx.lineWidth = (opts.active ? 3.5 : 1.5) / opts.scale;
    ctx.beginPath();
    ctx.arc(shape.c.x, shape.c.y, shape.r, shape.a0, shape.a0 + sweep, sweep < 0);
    ctx.stroke();
  },
  translate: (shape, delta) => ({ ...shape, c: { x: shape.c.x + delta.x, y: shape.c.y + delta.y } }),
  nearest: (shape, world) => {
    let best = pointOnArc(shape.c, shape.r, shape.a0);
    let bestD = distToSegment(world, best, best);
    for (let i = 1; i <= SAMPLES; i++) {
      const angle = shape.a0 + (shape.a1 - shape.a0) * (i / SAMPLES);
      const q = pointOnArc(shape.c, shape.r, angle);
      const d = Math.hypot(world.x - q.x, world.y - q.y);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return { point: best, dist: bestD };
  },
  bbox: (shape) => {
    const { start, end } = arcEndpoints(shape);
    return [shape.c, start, end, { x: shape.c.x + shape.r, y: shape.c.y }, { x: shape.c.x - shape.r, y: shape.c.y }];
  },
  toSVG: (shape, { ink }) => {
    const sweep = normalizeAngle(shape.a1 - shape.a0);
    const large = Math.abs(sweep) > Math.PI ? 1 : 0;
    const flag = sweep >= 0 ? 1 : 0;
    const e = { x: shape.c.x + shape.r * Math.cos(shape.a1), y: shape.c.y + shape.r * Math.sin(shape.a1) };
    const s = { x: shape.c.x + shape.r * Math.cos(shape.a0), y: shape.c.y + shape.r * Math.sin(shape.a0) };
    return `<path d="M ${s.x} ${s.y} A ${shape.r} ${shape.r} 0 ${large} ${flag} ${e.x} ${e.y}" ${strokeAttr(shape.style, ink)}/>`;
  },
  parse: (value, id, style) => {
    if (!isRecord(value) || value.type !== 'arc') return null;
    const c = parseVec(value.c);
    if (!c || !isFiniteNumber(value.r) || value.r < 0) return null;
    if (!isFiniteNumber(value.a0) || !isFiniteNumber(value.a1)) return null;
    return { id, type: 'arc', c, r: value.r, a0: value.a0, a1: value.a1, style };
  },
});
