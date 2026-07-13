import type { Tool } from './types';

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();
  private readonly listeners = new Set<() => void>();

  register(tool: Tool): void {
    this.tools.set(tool.id, tool);
    this.listeners.forEach((listener) => listener());
  }

  /** Notify when a tool is registered (so the toolbar can show new tools that
   *  plugins added after startup). */
  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }
}
