import type { Scene } from '../core/types';
import { getFormulaRenderer, renderMixedHTML } from '../core/formula';
import { esc } from '../core/parse';
import { SHAPE_INK, SHAPE_SELECT } from '../core/constants';
import type { Selection } from './selection';
import type { Viewport } from './viewport';

/** Renders label shapes as HTML elements overlaid on the canvas. Using the DOM
 *  means `$...$` math can be typeset by a plugin (KaTeX) straight to HTML —
 *  no canvas rasterization, always crisp, and sized exactly like the other
 *  labels. The canvas itself no longer draws label text. */
export class LabelLayer {
  private elements = new Map<string, HTMLElement>();
  private cssInjected = false;

  constructor(private readonly root: HTMLElement) {}

  render(scene: Scene, selection: Selection, viewport: Viewport): void {
    const r = getFormulaRenderer();
    if (r && !this.cssInjected) {
      const style = document.createElement('style');
      style.textContent = r.css();
      this.root.appendChild(style);
      this.cssInjected = true;
    }
    const present = new Set<string>();
    for (const id of scene.order) {
      const shape = scene.shapes[id];
      if (!shape || shape.type !== 'label') continue;
      present.add(id);
      const el = this.ensure(id);
      el.style.display = shape.hidden ? 'none' : '';
      el.style.color = selection.has(id) ? SHAPE_SELECT : SHAPE_INK;
      const screen = viewport.toScreen(shape.at);
      el.style.left = `${screen.x}px`;
      el.style.top = `${screen.y}px`;
      const html = renderMixedHTML(shape.text, esc);
      if (el.innerHTML !== html) el.innerHTML = html;
    }
    for (const [id, el] of this.elements) {
      if (!present.has(id)) {
        el.remove();
        this.elements.delete(id);
      }
    }
  }

  private ensure(id: string): HTMLElement {
    let el = this.elements.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'label';
      this.root.appendChild(el);
      this.elements.set(id, el);
    }
    return el;
  }
}
