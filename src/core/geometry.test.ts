import { describe, it, expect } from 'vitest';
import './shapes';
import { dist, distToSegment, pointsEqual, normalizeAngle, MIN_RADIUS, finiteVec, midpoint, regularPolygon, pointInPolygon } from './geometry';
import { translateShape, shapeEdgeAt } from './shapes/registry';
import type { SegmentShape, LabelShape, ArcShape, AngleLabelShape, TickShape } from './types';

describe('geometry', () => {
  it('dist computes euclidean distance', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('distToSegment projects onto segment', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(distToSegment({ x: 5, y: 3 }, a, b)).toBeCloseTo(3);
    expect(distToSegment({ x: -2, y: 0 }, a, b)).toBeCloseTo(2);
    expect(distToSegment({ x: 12, y: 0 }, a, b)).toBeCloseTo(2);
  });

  it('translateShape moves every shape type', () => {
    const delta = { x: 1, y: -2 };
    const segment: SegmentShape = { id: 's1', type: 'segment', a: { x: 0, y: 0 }, b: { x: 2, y: 2 }, style: { stroke: '#0f0', fill: '#000', width: 1 } };
    const moved = translateShape(segment, delta) as SegmentShape;
    expect(moved.a).toEqual({ x: 1, y: -2 });
    expect(moved.b).toEqual({ x: 3, y: 0 });
  });

  it('translateShape moves a label', () => {
    const delta = { x: 1, y: -2 };
    const label: LabelShape = { id: 'l', type: 'label', text: 'x', at: { x: 2, y: 3 }, style: { stroke: '#0f0', fill: '#000', width: 1 } };
    const moved = translateShape(label, delta) as LabelShape;
    expect(moved.at).toEqual({ x: 3, y: 1 });
  });

  it('translateShape moves arc / angleLabel / tick (B1 regression)', () => {
    const delta = { x: 1, y: 2 };
    const arc: ArcShape = { id: 'a', type: 'arc', c: { x: 0, y: 0 }, r: 5, a0: 0, a1: 1, style: { stroke: '#0f0', fill: '#000', width: 1 } };
    const movedArc = translateShape(arc, delta) as ArcShape;
    expect(movedArc.c).toEqual({ x: 1, y: 2 });
    const ang: AngleLabelShape = { id: 'g', type: 'angleLabel', vertex: { x: 0, y: 0 }, dirA: { x: 1, y: 0 }, dirB: { x: 0, y: 1 }, text: '', style: { stroke: '#0f0', fill: '#000', width: 1 } };
    const movedAng = translateShape(ang, delta) as AngleLabelShape;
    expect(movedAng.vertex).toEqual({ x: 1, y: 2 });
    const tick: TickShape = { id: 't', type: 'tick', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, count: 1, style: { stroke: '#0f0', fill: '#000', width: 1 } };
    const movedTick = translateShape(tick, delta) as TickShape;
    expect(movedTick.a).toEqual({ x: 1, y: 2 });
    expect(movedTick.b).toEqual({ x: 5, y: 2 });
  });

  it('pointsEqual respects epsilon', () => {
    expect(pointsEqual({ x: 0, y: 0 }, { x: 1e-9, y: 0 })).toBe(true);
    expect(pointsEqual({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });

  it('normalizeAngle wraps into (-PI, PI]', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
    expect(normalizeAngle(Math.PI * 2)).toBeCloseTo(0);
    expect(normalizeAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
  });

  it('MIN_RADIUS rejects degenerate shapes', () => {
    expect(MIN_RADIUS).toBeGreaterThan(0);
  });

  it('finiteVec guards NaN and overflow', () => {
    expect(finiteVec({ x: NaN, y: Infinity })).toEqual({ x: 0, y: 0 });
    expect(finiteVec({ x: 1e9, y: -1e9 }).x).toBe(1e7);
  });

  it('midpoint averages two points', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 4, y: 6 })).toEqual({ x: 2, y: 3 });
  });

  it('regularPolygon keeps the first edge and has equal sides', () => {
    const sq = regularPolygon({ x: 0, y: 0 }, { x: 4, y: 0 }, 4);
    expect(sq).toHaveLength(4);
    expect(sq[0].x).toBeCloseTo(0);
    expect(sq[0].y).toBeCloseTo(0);
    expect(sq[1].x).toBeCloseTo(4);
    expect(sq[1].y).toBeCloseTo(0);
    for (let i = 0; i < 4; i++) {
      const a = sq[i];
      const b = sq[(i + 1) % 4];
      expect(dist(a, b)).toBeCloseTo(4);
    }
  });

  it('regularPolygon builds an equilateral triangle', () => {
    const tri = regularPolygon({ x: 0, y: 0 }, { x: 3, y: 0 }, 3);
    expect(tri).toHaveLength(3);
    expect(dist(tri[1], tri[2])).toBeCloseTo(3);
    expect(dist(tri[2], tri[0])).toBeCloseTo(3);
  });

  it('pointInPolygon uses ray casting', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(pointInPolygon(sq, { x: 2, y: 2 })).toBe(true);
    expect(pointInPolygon(sq, { x: 5, y: 5 })).toBe(false);
  });

  it('shapeEdgeAt resolves a segment or the nearest polygon edge', () => {
    const seg = { id: 's', type: 'segment' as const, a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, style: { stroke: '#0f0', fill: '#000', width: 1 } };
    expect(shapeEdgeAt(seg, { x: 1, y: 0 })).toEqual({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 } });
    const poly = {
      id: 'p',
      type: 'polygon' as const,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      style: { stroke: '#0f0', fill: '#000', width: 1 },
    };
    // near the bottom edge -> that edge
    expect(shapeEdgeAt(poly, { x: 5, y: 1 })).toEqual({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
    // near the right edge -> that edge
    expect(shapeEdgeAt(poly, { x: 9, y: 5 })).toEqual({ a: { x: 10, y: 0 }, b: { x: 10, y: 10 } });
  });

  it('shapeEdgeAt returns null for shapes without a straight edge', () => {
    const circle = { id: 'c', type: 'circle' as const, c: { x: 0, y: 0 }, r: 5, style: { stroke: '#0f0', fill: '#000', width: 1 } };
    expect(shapeEdgeAt(circle, { x: 1, y: 1 })).toBeNull();
  });
});
