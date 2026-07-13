import type { MathPainter } from '../core/extension';
import { API_VERSION } from '../core/extension';
import { registerShape } from '../core/shapes/registry';
import type { ToolRegistry } from '../tools/registry';
import type { InputController } from './input';

/**
 * Build the frozen `MathPainter` facade a plugin receives. It only exposes the
 * stable registration surface — never the raw `Editor`/`ToolRegistry` internals
 * — so the contract stays small and breakage-free across core refactors.
 */
export function createMathPainter(tools: ToolRegistry, input: InputController): MathPainter {
  return {
    apiVersion: API_VERSION,
    registerShape: (definition) => registerShape(definition),
    registerTool: (tool) => tools.register(tool),
    bindKey: (key, toolId) => input.bindPluginKey(key, toolId),
  };
}
