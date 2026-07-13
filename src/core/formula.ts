/** A pluggable math renderer (e.g. a KaTeX-backed plugin). The built-in label
 *  delegates `$...$` segments to it; if none is registered, math shows as
 *  literal text. Keeping the renderer pluggable means the core stays free of
 *  any heavy typesetting dependency (cold start stays fast). */
export interface FormulaRenderer {
  /** KaTeX CSS (or an `@import` rule) required to render the HTML. */
  css(): string;
  /** Render inline TeX to an HTML string (no wrapper element). */
  toHTML(tex: string): string;
}

let renderer: FormulaRenderer | null = null;

/** Register (or clear, with null) the active formula renderer. */
export function setFormulaRenderer(r: FormulaRenderer | null): void {
  renderer = r;
}

export function getFormulaRenderer(): FormulaRenderer | null {
  return renderer;
}

export interface TextSegment {
  math: boolean;
  value: string;
}

/** Split text into plain and math segments delimited by single `$...$`. */
export function parseMixed(text: string): TextSegment[] {
  const segs: TextSegment[] = [];
  const re = /\$([^$]+)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ math: false, value: text.slice(last, m.index) });
    if (m[1].trim()) segs.push({ math: true, value: m[1] });
    last = re.lastIndex;
  }
  if (last < text.length) segs.push({ math: false, value: text.slice(last) });
  if (!segs.length) segs.push({ math: false, value: text });
  return segs;
}

/** Build inner HTML for a label: plain text escaped, math rendered via the
 *  active renderer (literal `$...$` when none is installed). */
export function renderMixedHTML(text: string, escape: (s: string) => string): string {
  const r = getFormulaRenderer();
  return parseMixed(text)
    .map((s) => (s.math ? (r ? r.toHTML(s.value) : escape(`$${s.value}$`)) : escape(s.value)))
    .join('');
}
