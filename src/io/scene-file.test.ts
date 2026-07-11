import { describe, it, expect } from 'vitest';
import '../core/shapes';
import { parseScene, serializeScene, ParseError } from './scene-file';
import type { Scene, SegmentShape } from '../core/types';

function validScene(): Scene {
  return {
    shapes: {
      s1: { id: 's1', type: 'point', p: { x: 1, y: 2 }, style: { stroke: '#0f0', fill: '#000', width: 1 } },
    },
    order: ['s1'],
  };
}

const style = { stroke: '#0f0', fill: '#000', width: 1 };

describe('scene-file', () => {
  it('round-trips a valid scene', () => {
    const scene = validScene();
    const parsed = parseScene(JSON.parse(serializeScene(scene)));
    expect(parsed).toEqual(scene);
  });

  it('rejects non-object input', () => {
    expect(() => parseScene(null)).toThrow(ParseError);
    expect(() => parseScene(42)).toThrow(ParseError);
    expect(() => parseScene('nope')).toThrow(ParseError);
  });

  it('rejects missing order or shapes field', () => {
    expect(() => parseScene({ shapes: {} })).toThrow(ParseError);
    expect(() => parseScene({ order: [] })).toThrow(ParseError);
  });

  it('accepts an empty scene', () => {
    expect(parseScene({ shapes: {}, order: [] })).not.toBeNull();
  });

  it('rejects duplicate or mismatched order ids', () => {
    expect(() => parseScene({ shapes: { s1: validScene().shapes.s1 }, order: ['s1', 's1'] })).toThrow(ParseError);
    expect(() => parseScene({ shapes: { s1: validScene().shapes.s1 }, order: ['s2'] })).toThrow(ParseError);
  });

  it('rejects shapes with bad id or type', () => {
    expect(() => parseScene({ shapes: { s1: { type: 'point', p: { x: 0, y: 0 }, style } }, order: ['s1'] })).toThrow(ParseError);
    expect(() => parseScene({ shapes: { s1: { id: 'x', type: 'point', p: { x: 0, y: 0 }, style } }, order: ['s1'] })).toThrow(ParseError);
  });

  it('rejects a prototype-polluting key', () => {
    const evil = {
      shapes: { __proto__: { id: '__proto__', type: 'point', p: { x: 0, y: 0 }, style } },
      order: ['__proto__'],
    };
    expect(() => parseScene(evil)).toThrow(ParseError);
  });

  it('parses an arc shape', () => {
    const scene = {
      shapes: { a1: { id: 'a1', type: 'arc', c: { x: 0, y: 0 }, r: 5, a0: 0, a1: 1.5, style } },
      order: ['a1'],
    };
    expect(parseScene(scene)).toEqual(scene);
  });

  it('parses an angleLabel shape', () => {
    const scene = {
      shapes: {
        l1: {
          id: 'l1',
          type: 'angleLabel',
          aId: 's1',
          bId: 's2',
          vertex: { x: 0, y: 0 },
          dirA: { x: 1, y: 0 },
          dirB: { x: 0, y: 1 },
          text: '90°',
          style,
        },
      },
      order: ['l1'],
    };
    expect(parseScene(scene)).toEqual(scene);
  });

  it('parses an angleLabel without references (three-point angle)', () => {
    const scene = {
      shapes: {
        l1: { id: 'l1', type: 'angleLabel', vertex: { x: 0, y: 0 }, dirA: { x: 1, y: 0 }, dirB: { x: 0, y: 1 }, text: 'x', style },
      },
      order: ['l1'],
    };
    expect(parseScene(scene)).toEqual(scene);
  });

  it('parses a point with a label', () => {
    const scene = {
      shapes: { p1: { id: 'p1', type: 'point', p: { x: 1, y: 2 }, label: 'A', style } },
      order: ['p1'],
    };
    expect(parseScene(scene)).toEqual(scene);
  });

  it('parses an angleLabel with a right-angle flag', () => {
    const scene = {
      shapes: {
        l1: { id: 'l1', type: 'angleLabel', vertex: { x: 0, y: 0 }, dirA: { x: 1, y: 0 }, dirB: { x: 0, y: 1 }, text: '90°', right: true, style },
      },
      order: ['l1'],
    };
    expect(parseScene(scene)).toEqual(scene);
  });

  it('parses a tick mark', () => {
    const scene = {
      shapes: { t1: { id: 't1', type: 'tick', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, count: 2, style } },
      order: ['t1'],
    };
    expect(parseScene(scene)).toEqual(scene);
  });

  it('parses a free label (and legacy measure) shape', () => {
    const scene = {
      shapes: {
        l1: { id: 'l1', type: 'label', text: 'S', at: { x: 2, y: 1 }, style },
        m1: { id: 'm1', type: 'measure', text: '16', at: { x: 1, y: 1 }, style },
      },
      order: ['l1', 'm1'],
    };
    const parsed = parseScene(scene);
    expect(parsed).not.toBeNull();
    // new label keeps its type; legacy 'measure' is accepted as a label
    expect(parsed?.shapes.l1.type).toBe('label');
    expect(parsed?.shapes.m1.type).toBe('label');
  });

  it('rejects a label with missing text or position', () => {
    const noText = { shapes: { l1: { id: 'l1', type: 'label', at: { x: 1, y: 1 }, style } }, order: ['l1'] };
    const noAt = { shapes: { l1: { id: 'l1', type: 'label', text: 'x', style } }, order: ['l1'] };
    expect(() => parseScene(noText)).toThrow(ParseError);
    expect(() => parseScene(noAt)).toThrow(ParseError);
  });

  it('parses and round-trips the hidden flag', () => {
    const seg: SegmentShape = { id: 's1', type: 'segment', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, hidden: true, style };
    const scene: Scene = { shapes: { s1: seg }, order: ['s1'] };
    const parsed = parseScene(JSON.parse(serializeScene(scene)));
    expect(parsed).not.toBeNull();
    expect(parsed?.shapes.s1.hidden).toBe(true);
  });

  it('rejects a tick with no count or out-of-range count', () => {
    expect(() => parseScene({ shapes: { t1: { id: 't1', type: 'tick', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, style } }, order: ['t1'] })).toThrow(ParseError);
    expect(() => parseScene({ shapes: { t1: { id: 't1', type: 'tick', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, count: 0, style } }, order: ['t1'] })).toThrow(ParseError);
  });

  it('reports which shape failed via ParseError.id', () => {
    let caught: ParseError | undefined;
    try {
      parseScene({ shapes: { bad: { id: 'bad', type: 'point', p: 'nope', style } }, order: ['bad'] });
    } catch (error) {
      caught = error as ParseError;
    }
    expect(caught).toBeInstanceOf(ParseError);
    expect(caught?.id).toBe('bad');
  });
});
