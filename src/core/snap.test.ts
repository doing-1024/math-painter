import { describe, it, expect } from 'vitest';
import './shapes';
import { snapToAnchors, snapWorld, pickPoint } from './snap';
import type { Scene } from './types';

describe('snap', () => {
  const anchors = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ];

  it('returns nearest anchor within tolerance', () => {
    expect(snapToAnchors(anchors, { x: 1, y: 0 }, 5)).toEqual({ x: 0, y: 0 });
  });

  it('returns null when nothing is close enough', () => {
    expect(snapToAnchors(anchors, { x: 100, y: 100 }, 5)).toBeNull();
  });

  it('tolerance is inclusive', () => {
    expect(snapToAnchors(anchors, { x: 5, y: 10 }, 5)).toEqual({ x: 10, y: 10 });
  });

  it('snapWorld combines scene anchors with extra points', () => {
    const scene: Scene = {
      shapes: { s1: { id: 's1', type: 'point', p: { x: 20, y: 20 }, style: { stroke: '#0f0', fill: '#000', width: 1 } } },
      order: ['s1'],
    };
    expect(snapWorld(scene, { x: 21, y: 20 }, 5)).toEqual({ x: 20, y: 20 });
    expect(snapWorld(scene, { x: 31, y: 20 }, 5, [{ x: 30, y: 20 }])).toEqual({ x: 30, y: 20 });
  });

  const sceneWithSegment: Scene = {
    shapes: {
      a: { id: 'a', type: 'point', p: { x: 0, y: 0 }, style: { stroke: '#0f0', fill: '#000', width: 1 } },
      s: { id: 's', type: 'segment', a: { x: 0, y: 100 }, b: { x: 100, y: 100 }, style: { stroke: '#0f0', fill: '#000', width: 1 } },
    },
    order: ['a', 's'],
  };

  it('pickPoint prefers anchors over edges', () => {
    // near the segment midpoint but also near the point anchor at (0,0)?
    // place cursor near (0,0): anchor wins over the far edge
    const r = pickPoint(sceneWithSegment, { x: 1, y: 0 }, 1);
    expect(r.point).toEqual({ x: 0, y: 0 });
    expect(r.snap).toEqual({ x: 0, y: 0 });
  });

  it('pickPoint falls back to edge snapping', () => {
    // far from anchors, near the segment (y=100): snaps onto the edge
    const r = pickPoint(sceneWithSegment, { x: 50, y: 102 }, 1);
    expect(r.point).toEqual({ x: 50, y: 100 });
    expect(r.snap).toEqual({ x: 50, y: 100 });
  });

  it('pickPoint leaves the point free when nothing is close', () => {
    const world = { x: 500, y: 500 };
    const r = pickPoint(sceneWithSegment, world, 1);
    expect(r.point).toEqual(world);
    expect(r.snap).toBeNull();
  });

  it('pickPoint excludes the given shape ids (used while dragging)', () => {
    // (0,0) is the anchor of shape 'a'; excluding 'a' should leave the point free
    const r = pickPoint(sceneWithSegment, { x: 1, y: 0 }, 1, [], new Set(['a']));
    expect(r.point).toEqual({ x: 1, y: 0 });
    expect(r.snap).toBeNull();
  });
});
