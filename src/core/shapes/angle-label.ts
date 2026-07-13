import type { AngleLabelShape, Vec } from '../types';
import { registerShape } from './registry';
import { normalizeAngle, distToSegment, move } from '../geometry';
import { distToAngleArc, ANGLE_ARC_RADIUS } from '../angle';
import { isRecord, parseVec, esc, strokeAttr } from '../parse';
import { ANGLE_ARC_RADIUS_PX, HIT_TOLERANCE_PX, RIGHT_SQUARE_PX, GLYPH_FONT_PX } from '../constants';

const R = (scale: number): number => ANGLE_ARC_RADIUS_PX / scale;
const LABEL_OFFSET = 16;

registerShape<AngleLabelShape>({
  type: 'angleLabel',
  anchors: (shape) => [shape.vertex],
  hit: (shape, world, tolerance) => {
    if (Math.hypot(world.x - shape.vertex.x, world.y - shape.vertex.y) < tolerance * 2) return true;
    const r = ANGLE_ARC_RADIUS / HIT_TOLERANCE_PX * tolerance; // = radius/scale
    for (const dir of [shape.dirA, shape.dirB]) {
      const end = { x: shape.vertex.x + r * dir.x, y: shape.vertex.y + r * dir.y };
      if (distToSegment(world, shape.vertex, end) < tolerance) return true;
    }
    return distToAngleArc(shape.vertex, shape.dirA, shape.dirB, world, r) < tolerance * 2;
  },
  draw: (ctx, shape, opts) => {
    const r = R(opts.scale);
    const angA = Math.atan2(shape.dirA.y, shape.dirA.x);
    const angB = Math.atan2(shape.dirB.y, shape.dirB.x);
    const sweep = normalizeAngle(angB - angA);
    ctx.strokeStyle = shape.style.stroke;
    ctx.lineWidth = (opts.active ? 2.5 : 1.5) / opts.scale;
    if (shape.right) {
      const s = RIGHT_SQUARE_PX / opts.scale;
      const ax = shape.vertex.x + s * shape.dirA.x;
      const ay = shape.vertex.y + s * shape.dirA.y;
      const bx = shape.vertex.x + s * shape.dirB.x;
      const by = shape.vertex.y + s * shape.dirB.y;
      ctx.beginPath();
      ctx.moveTo(shape.vertex.x, shape.vertex.y);
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax + (bx - shape.vertex.x), ay + (by - shape.vertex.y));
      ctx.lineTo(bx, by);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(shape.vertex.x, shape.vertex.y);
      ctx.lineTo(shape.vertex.x + r * Math.cos(angA), shape.vertex.y + r * Math.sin(angA));
      ctx.moveTo(shape.vertex.x, shape.vertex.y);
      ctx.lineTo(shape.vertex.x + r * Math.cos(angB), shape.vertex.y + r * Math.sin(angB));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(shape.vertex.x, shape.vertex.y, r, angA, angA + sweep, sweep < 0);
      ctx.stroke();
    }
    if (shape.text) {
      const mid = angA + sweep / 2;
      const baseR = shape.right ? RIGHT_SQUARE_PX : r;
      const labelR = baseR + LABEL_OFFSET / opts.scale;
      const at: Vec = { x: shape.vertex.x + labelR * Math.cos(mid), y: shape.vertex.y + labelR * Math.sin(mid) };
      ctx.fillStyle = shape.style.stroke;
      ctx.font = `${GLYPH_FONT_PX / opts.scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shape.text, at.x, at.y);
    }
  },
  translate: (shape, delta) => ({ ...shape, vertex: move(shape.vertex, delta) }),
  nearest: (shape, world) => ({ point: shape.vertex, dist: Math.hypot(world.x - shape.vertex.x, world.y - shape.vertex.y) }),
  bbox: (shape) => [shape.vertex],
  cascadeIds: (shape) => [shape.aId, shape.bId].filter((id): id is string => typeof id === 'string'),
  toSVG: (shape, { ink }) => {
    const sweep = normalizeAngle(Math.atan2(shape.dirB.y, shape.dirB.x) - Math.atan2(shape.dirA.y, shape.dirA.x));
    const mid = Math.atan2(shape.dirA.y, shape.dirA.x) + sweep / 2;
    const lt = { x: shape.vertex.x + (ANGLE_ARC_RADIUS_PX + LABEL_OFFSET) * Math.cos(mid), y: shape.vertex.y + (ANGLE_ARC_RADIUS_PX + LABEL_OFFSET) * Math.sin(mid) };
    const label = shape.text ? `<text x="${lt.x}" y="${lt.y}" font-family="monospace" font-size="${GLYPH_FONT_PX}" fill="${ink}" text-anchor="middle">${esc(shape.text)}</text>` : '';
    if (shape.right) {
      const a = { x: shape.vertex.x + RIGHT_SQUARE_PX * shape.dirA.x, y: shape.vertex.y + RIGHT_SQUARE_PX * shape.dirA.y };
      const b = { x: shape.vertex.x + RIGHT_SQUARE_PX * shape.dirB.x, y: shape.vertex.y + RIGHT_SQUARE_PX * shape.dirB.y };
      const corner = { x: a.x + (b.x - shape.vertex.x), y: a.y + (b.y - shape.vertex.y) };
      return `<path d="M ${shape.vertex.x} ${shape.vertex.y} L ${a.x} ${a.y} L ${corner.x} ${corner.y} L ${b.x} ${b.y} Z" ${strokeAttr(shape.style, ink)}/>` + label;
    }
    const a = { x: shape.vertex.x + ANGLE_ARC_RADIUS_PX * shape.dirA.x, y: shape.vertex.y + ANGLE_ARC_RADIUS_PX * shape.dirA.y };
    const b = { x: shape.vertex.x + ANGLE_ARC_RADIUS_PX * shape.dirB.x, y: shape.vertex.y + ANGLE_ARC_RADIUS_PX * shape.dirB.y };
    const large = Math.abs(sweep) > Math.PI ? 1 : 0;
    const flag = sweep >= 0 ? 1 : 0;
    return `<line x1="${shape.vertex.x}" y1="${shape.vertex.y}" x2="${a.x}" y2="${a.y}" ${strokeAttr(shape.style, ink)}/>` +
      `<line x1="${shape.vertex.x}" y1="${shape.vertex.y}" x2="${b.x}" y2="${b.y}" ${strokeAttr(shape.style, ink)}/>` +
      `<path d="M ${a.x} ${a.y} A ${ANGLE_ARC_RADIUS_PX} ${ANGLE_ARC_RADIUS_PX} 0 ${large} ${flag} ${b.x} ${b.y}" ${strokeAttr(shape.style, ink)}/>` +
      label;
  },
  parse: (value, id, style) => {
    if (!isRecord(value) || value.type !== 'angleLabel') return null;
    const vertex = parseVec(value.vertex);
    const dirA = parseVec(value.dirA);
    const dirB = parseVec(value.dirB);
    if (!vertex || !dirA || !dirB || typeof value.text !== 'string') return null;
    const aId = typeof value.aId === 'string' ? value.aId : undefined;
    const bId = typeof value.bId === 'string' ? value.bId : undefined;
    return {
      id,
      type: 'angleLabel',
      ...(aId ? { aId } : {}),
      ...(bId ? { bId } : {}),
      vertex,
      dirA,
      dirB,
      text: value.text,
      ...(value.right === true ? { right: true } : {}),
      style,
    };
  },
});
