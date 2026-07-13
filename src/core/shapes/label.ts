import type { LabelShape } from '../types';
import { registerShape } from './registry';
import { dist } from '../geometry';
import { isRecord, parseVec, esc } from '../parse';
import { GLYPH_FONT_PX } from '../constants';
import { getFormulaRenderer, parseMixed, renderMixedHTML } from '../formula';

registerShape<LabelShape>({
  type: 'label',
  // No structural anchor: the label has no grab dot (drawing one would obscure
  // the text). The HTML overlay shows it instead of the canvas.
  anchors: () => [],
  hit: (shape, world, tolerance) => dist(world, shape.at) < tolerance * 2,
  // Labels render as HTML over the canvas; the canvas draws nothing for them.
  draw: () => {},
  translate: (shape, delta) => ({ ...shape, at: { x: shape.at.x + delta.x, y: shape.at.y + delta.y } }),
  nearest: (shape, world) => ({ point: shape.at, dist: dist(world, shape.at) }),
  bbox: (shape) => [shape.at],
  toSVG: (shape, { ink }) => {
    const r = getFormulaRenderer();
    const segs = parseMixed(shape.text);
    const hasMath = !!r && segs.some((s) => s.math);
    const styleBlock = hasMath ? `<style>${r!.css()}</style>` : '';
    const inner = renderMixedHTML(shape.text, esc);
    const w = Math.max(200, shape.text.length * 8);
    const h = 40;
    return (
      `<foreignObject x="${shape.at.x - w / 2}" y="${shape.at.y - h / 2}" width="${w}" height="${h}" overflow="visible">` +
      `${styleBlock}` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="color:${ink};font-family:monospace;font-size:${GLYPH_FONT_PX}px;line-height:1;white-space:nowrap;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${inner}</div>` +
      `</foreignObject>`
    );
  },
  parse: (value, id, style) => {
    // Legacy 'measure' and 'latex' shapes are accepted and folded into a plain
    // label (a latex shape becomes a `$...$` segment the renderer understands).
    if (!isRecord(value)) return null;
    if (value.type === 'label' || value.type === 'measure') {
      const at = parseVec(value.at);
      if (!at || typeof value.text !== 'string') return null;
      return { id, type: 'label', text: value.text, at, style };
    }
    if (value.type === 'latex') {
      const at = parseVec(value.at);
      if (!at || typeof value.tex !== 'string') return null;
      return { id, type: 'label', text: `$${value.tex}$`, at, style };
    }
    return null;
  },
});
