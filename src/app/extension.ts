import type { MathPainter } from '../core/extension';
import { API_VERSION } from '../core/extension';
import { registerShape } from '../core/shapes/registry';
import { setFormulaRenderer } from '../core/formula';
import type { ToolRegistry } from '../tools/registry';
import type { InputController } from './input';
import type { Editor } from './editor';

/**
 * Build the frozen `MathPainter` facade a plugin receives. It only exposes the
 * stable registration surface — never the raw `Editor`/`ToolRegistry` internals
 * — so the contract stays small and breakage-free across core refactors.
 */
export function createMathPainter(tools: ToolRegistry, input: InputController, editor: Editor): MathPainter {
  return {
    apiVersion: API_VERSION,
    registerShape: (definition) => registerShape(definition),
    registerTool: (tool) => tools.register(tool),
    bindKey: (key, toolId) => input.bindPluginKey(key, toolId),
    // Installing a formula renderer can change how existing labels render, so
    // repaint once it is set.
    setFormulaRenderer: (renderer) => {
      setFormulaRenderer(renderer);
      editor.draw();
    },
  };
}
