import { describe, it, expect } from 'vitest';
import '../core/shapes';
import { sceneToSVG } from './svg';
import type { Scene } from '../core/types';

const baseStyle = { stroke: '#0f0', fill: '#000', width: 1.5 };

function scene(): Scene {
  return {
    shapes: {
      s1: { id: 's1', type: 'segment', a: { x: 0, y: 0 }, b: { x: 40, y: 0 }, style: baseStyle },
      s2: { id: 's2', type: 'tick', a: { x: 0, y: 0 }, b: { x: 40, y: 0 }, count: 2, style: baseStyle },
      s4: { id: 's4', type: 'label', text: '5', at: { x: 20, y: 8 }, style: baseStyle },
      hidden: { id: 'hidden', type: 'circle', c: { x: 100, y: 100 }, r: 10, hidden: true, style: baseStyle },
    },
    order: ['s1', 's2', 's4', 'hidden'],
  };
}

describe('sceneToSVG', () => {
  it('emits an svg root with a viewBox', () => {
    const svg = sceneToSVG(scene());
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox=');
  });

  it('renders visible geometry but omits hidden shapes', () => {
    const svg = sceneToSVG(scene());
    expect(svg).toContain('<line');
    expect((svg.match(/<line/g) ?? []).length).toBeGreaterThanOrEqual(3); // segment + 2 tick lines
    expect(svg).toContain('5'); // measure text
    expect(svg).not.toContain('cx="100"'); // hidden circle excluded
    expect(svg).not.toContain('cy="100"');
  });

  it('contains no grid or UI chrome', () => {
    const svg = sceneToSVG(scene());
    expect(svg).not.toContain('grid');
  });

  it('escapes text content', () => {
    const s: Scene = {
      shapes: { m: { id: 'm', type: 'label', text: 'a < b & "c"', at: { x: 0, y: 0 }, style: baseStyle } },
      order: ['m'],
    };
    const svg = sceneToSVG(s);
    expect(svg).toContain('a &lt; b &amp; &quot;c&quot;');
  });
});
