import { describe, it, expect, afterEach } from 'vitest';
import { parseMixed, renderMixedHTML, setFormulaRenderer, type FormulaRenderer } from './formula';
import { esc } from './parse';

afterEach(() => setFormulaRenderer(null));

describe('parseMixed', () => {
  it('splits text on single $...$ delimiters', () => {
    expect(parseMixed('角度 = $45^\\circ$')).toEqual([
      { math: false, value: '角度 = ' },
      { math: true, value: '45^\\circ' },
    ]);
  });

  it('treats plain text as a single segment', () => {
    expect(parseMixed('hello')).toEqual([{ math: false, value: 'hello' }]);
  });

  it('keeps the raw text when there is no math', () => {
    expect(parseMixed('a $ b')).toEqual([{ math: false, value: 'a $ b' }]);
  });
});

describe('renderMixedHTML', () => {
  it('shows literal $...$ when no renderer is installed', () => {
    expect(renderMixedHTML('x $y$ z', esc)).toBe('x $y$ z');
  });

  it('delegates math segments to the installed renderer', () => {
    const stub: FormulaRenderer = {
      css: () => '',
      toHTML: (tex) => `<k>${tex}</k>`,
    };
    setFormulaRenderer(stub);
    expect(renderMixedHTML('a $b$ c', esc)).toBe('a <k>b</k> c');
  });
});
