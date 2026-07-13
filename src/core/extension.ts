import type { Shape } from './types';
import type { ShapeDefinition } from './shapes/registry';
import type { Tool } from '../tools/types';
import type { FormulaRenderer } from './formula';
import type { ExportOptions } from '../io/canvas';

/**
 * Version of the frozen extension API. Plugins declare the minimum version
 * they require via `minApi`; the loader refuses to install a plugin that needs
 * a newer API than the running app. Bump only on breaking changes.
 */
export const API_VERSION = 2;

/**
 * The stable, frozen surface a plugin receives. A plugin module's default
 * export is called as `activate(mathPainter)` and may register shapes, tools,
 * and key bindings. This is the ONLY contract plugins depend on, so the core
 * is free to change its internals without breaking published plugins.
 */
export interface MathPainter {
  readonly apiVersion: number;
  /** Register a new shape type (drawing, hit-testing, snapping, SVG, IO...). */
  registerShape<T extends Shape>(definition: ShapeDefinition<T>): void;
  /** Register a new interactive tool (drawing, editing, annotation...). */
  registerTool(tool: Tool): void;
  /** Bind a single-key shortcut to a (registered) tool id. Built-in bindings
   *  take precedence, so pick a free left-half key. */
  bindKey(key: string, toolId: string): void;
  /** Register (or clear with null) the formula/math renderer used by the
   *  built-in label for `$$...$$` segments. Keeps heavy typesetting out of the
   *  core so cold start stays fast. */
  setFormulaRenderer(renderer: FormulaRenderer | null): void;
  /** Render the current scene to an SVG string (white background, dark ink,
   *  auto-cropped to content bounds). Used by export plugins. */
  renderSVG(opts?: ExportOptions): string;
  /** Render the current scene to a PNG-ready canvas (white background, black
   *  ink, auto-cropped). Returns null when the scene is empty. Used by export
   *  plugins. */
  renderCanvas(opts?: ExportOptions): HTMLCanvasElement | null;
}
