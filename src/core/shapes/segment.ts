import type { SegmentShape } from '../types';
import { registerShape } from './registry';
import { distToSegment, projectOnSegment } from '../geometry';
import { isRecord, parseVec, strokeAttr } from '../parse';

registerShape<SegmentShape>({
  type: 'segment',
  anchors: (shape) => [shape.a, shape.b],
  hit: (shape, world, tolerance) => distToSegment(world, shape.a, shape.b) < tolerance,
  draw: (ctx, shape, opts) => {
    ctx.strokeStyle = shape.style.stroke;
    ctx.lineWidth = (opts.active ? 2.5 : 1.5) / opts.scale;
    ctx.beginPath();
    ctx.moveTo(shape.a.x, shape.a.y);
    ctx.lineTo(shape.b.x, shape.b.y);
    ctx.stroke();
  },
  translate: (shape, delta) => ({ ...shape, a: { x: shape.a.x + delta.x, y: shape.a.y + delta.y }, b: { x: shape.b.x + delta.x, y: shape.b.y + delta.y } }),
  nearest: (shape, world) => {
    const point = projectOnSegment(world, shape.a, shape.b);
    return { point, dist: distToSegment(world, shape.a, shape.b) };
  },
  edgeAt: (shape) => ({ a: shape.a, b: shape.b }),
  bbox: (shape) => [shape.a, shape.b],
  toSVG: (shape, { ink }) => `<line x1="${shape.a.x}" y1="${shape.a.y}" x2="${shape.b.x}" y2="${shape.b.y}" ${strokeAttr(shape.style, ink)}/>`,
  parse: (value, id, style) => {
    if (!isRecord(value) || value.type !== 'segment') return null;
    const a = parseVec(value.a);
    const b = parseVec(value.b);
    return a && b ? { id, type: 'segment', a, b, style } : null;
  },
});
