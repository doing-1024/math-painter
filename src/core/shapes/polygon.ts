import type { PolygonShape, Vec } from '../types';
import { registerShape } from './registry';
import { distToSegment, pointInPolygon, projectOnSegment, polygonEdgeAt } from '../geometry';
import { isRecord, parseVec, strokeAttr } from '../parse';

registerShape<PolygonShape>({
  type: 'polygon',
  anchors: (shape) => shape.points,
  hit: (shape, world, tolerance) => {
    for (let i = 0; i < shape.points.length; i++) {
      const a = shape.points[i];
      const b = shape.points[(i + 1) % shape.points.length];
      if (distToSegment(world, a, b) < tolerance) return true;
    }
    return pointInPolygon(shape.points, world);
  },
  draw: (ctx, shape, opts) => {
    ctx.strokeStyle = opts.active ? '#ffffff' : shape.style.stroke;
    ctx.lineWidth = (opts.active ? 2.5 : 1.5) / opts.scale;
    ctx.beginPath();
    shape.points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
    ctx.closePath();
    ctx.stroke();
  },
  translate: (shape, delta) => ({ ...shape, points: shape.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })) }),
  nearest: (shape, world) => {
    let best = shape.points[0];
    let bestD = Infinity;
    for (let i = 0; i < shape.points.length; i++) {
      const q = projectOnSegment(world, shape.points[i], shape.points[(i + 1) % shape.points.length]);
      const d = Math.hypot(world.x - q.x, world.y - q.y);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return { point: best, dist: bestD };
  },
  edgeAt: (shape, world) => polygonEdgeAt(shape.points, world),
  bbox: (shape) => shape.points,
  toSVG: (shape, { ink }) => `<polygon points="${shape.points.map((p) => `${p.x},${p.y}`).join(' ')}" ${strokeAttr(shape.style, ink)}/>`,
  parse: (value, id, style) => {
    if (!isRecord(value) || value.type !== 'polygon') return null;
    if (!Array.isArray(value.points) || value.points.length < 3) return null;
    const points = value.points.map(parseVec);
    if (points.some((point) => !point)) return null;
    return { id, type: 'polygon', points: points as Vec[], style };
  },
});
