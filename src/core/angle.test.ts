import { describe, it, expect } from 'vitest';
import './shapes';
import { snapToEdge } from './angle';
import { nearestOnShape } from './shapes/registry';
import { angleBetweenDirs } from './geometry';
import type { SegmentShape, Scene } from './types';

describe('angle helpers', () => {
  const seg = (id: string, a: { x: number; y: number }, b: { x: number; y: number }): SegmentShape => ({
    id,
    type: 'segment',
    a,
    b,
    style: { stroke: '#0f0', fill: '#000', width: 1 },
  });

  it('angleBetweenDirs measures the right angle', () => {
    expect(angleBetweenDirs({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
  });

  it('nearestOnShape projects onto a segment', () => {
    const s = seg('s', { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(nearestOnShape(s, { x: 4, y: 3 })).toEqual({ point: { x: 4, y: 0 }, dist: 3 });
  });

  it('nearestOnShape reports the rim distance for a circle', () => {
    const c = { id: 'c', type: 'circle' as const, c: { x: 0, y: 0 }, r: 5, style: { stroke: '#0f0', fill: '#000', width: 1 } };
    expect(nearestOnShape(c, { x: 10, y: 0 }).dist).toBeCloseTo(5);
    expect(nearestOnShape(c, { x: 10, y: 0 }).point).toEqual({ x: 5, y: 0 });
  });

  it('snapToEdge snaps a nearby click onto the edge', () => {
    const scene: Scene = {
      shapes: { s: seg('s', { x: 0, y: 0 }, { x: 10, y: 0 }) },
      order: ['s'],
    };
    // 5px away in world units at scale 1, within the 14px tolerance
    expect(snapToEdge(scene, { x: 4, y: 5 }, 1)).toEqual({ x: 4, y: 0 });
  });

  it('snapToEdge leaves distant clicks untouched', () => {
    const scene: Scene = {
      shapes: { s: seg('s', { x: 0, y: 0 }, { x: 10, y: 0 }) },
      order: ['s'],
    };
    expect(snapToEdge(scene, { x: 100, y: 100 }, 1)).toEqual({ x: 100, y: 100 });
  });
});
