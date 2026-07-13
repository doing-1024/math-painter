import { describe, it, expect } from 'vitest';
import { sceneBounds } from './canvas';
import '../core/shapes'; // register shape definitions so def.bbox resolves
import type { Scene, Shape } from '../core/types';

const style = { stroke: '#ffffff', fill: '#ffffff', width: 1.5 };
const point = (id: string, x: number, y: number): Shape =>
  ({ id, type: 'point', p: { x, y }, style }) as Shape;
const segment = (id: string, a: { x: number; y: number }, b: { x: number; y: number }): Shape =>
  ({ id, type: 'segment', a, b, style }) as Shape;

const scene = (shapes: Shape[]): Scene => ({
  shapes: Object.fromEntries(shapes.map((s) => [s.id, s])),
  order: shapes.map((s) => s.id),
});

describe('sceneBounds', () => {
  it('returns null for an empty scene', () => {
    expect(sceneBounds({ shapes: {}, order: [] }, 24)).toBeNull();
  });

  it('returns null when every shape is hidden', () => {
    const s = scene([{ ...point('a', 10, 10), hidden: true }]);
    expect(sceneBounds(s, 24)).toBeNull();
  });

  it('crops to content and expands by the padding on every side', () => {
    // point at (10,20); segment from (0,0) to (100,50)
    const s = scene([point('a', 10, 20), segment('b', { x: 0, y: 0 }, { x: 100, y: 50 })]);
    expect(sceneBounds(s, 24)).toEqual({ minX: -24, minY: -24, maxX: 124, maxY: 74 });
  });

  it('omits hidden shapes from the bounds', () => {
    const s = scene([point('a', 10, 20), { ...segment('b', { x: 0, y: 0 }, { x: 100, y: 50 }), hidden: true }]);
    expect(sceneBounds(s, 24)).toEqual({ minX: -14, minY: -10, maxX: 40, maxY: 44 });
  });
});
