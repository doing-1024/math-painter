import { describe, it, expect } from 'vitest';
import './shapes';
import { boxSelectionIds, normalizeRect } from './select-box';
import type { Scene, Shape } from './types';

const style = { stroke: '#0f0', fill: '#000', width: 1 };

function scene(): Scene {
  const shapes: Record<string, Shape> = {
    seg: { id: 'seg', type: 'segment', a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, style },
    cir: { id: 'cir', type: 'circle', c: { x: 50, y: 50 }, r: 10, style },
    poly: { id: 'poly', type: 'polygon', points: [{ x: 100, y: 100 }, { x: 120, y: 100 }, { x: 110, y: 120 }], style },
    hid: { id: 'hid', type: 'segment', a: { x: 200, y: 200 }, b: { x: 210, y: 200 }, hidden: true, style },
  };
  return { shapes, order: ['seg', 'cir', 'poly', 'hid'] };
}

describe('box selection', () => {
  it('normalizeRect orders the corners', () => {
    expect(normalizeRect({ x: 5, y: 5 }, { x: 1, y: 1 })).toEqual({ x0: 1, y0: 1, x1: 5, y1: 5 });
  });

  it('selects a segment by its endpoint', () => {
    expect(boxSelectionIds(scene(), normalizeRect({ x: 0, y: 0 }, { x: 5, y: 5 }))).toEqual(['seg']);
  });

  it('selects a circle by its center', () => {
    expect(boxSelectionIds(scene(), normalizeRect({ x: 45, y: 45 }, { x: 55, y: 55 }))).toEqual(['cir']);
  });

  it('selects a polygon by its vertices', () => {
    expect(boxSelectionIds(scene(), normalizeRect({ x: 95, y: 95 }, { x: 125, y: 125 }))).toEqual(['poly']);
  });

  it('returns nothing for an empty area', () => {
    expect(boxSelectionIds(scene(), normalizeRect({ x: 300, y: 300 }, { x: 310, y: 310 }))).toEqual([]);
  });

  it('never selects hidden construction shapes', () => {
    expect(boxSelectionIds(scene(), normalizeRect({ x: 195, y: 195 }, { x: 215, y: 215 }))).toEqual([]);
  });
});
