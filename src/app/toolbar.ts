import type { Editor } from './editor';
import type { ToolRegistry } from '../tools/registry';

const TOOL_KEYS: Record<string, string> = {
  select: 'V',
  point: 'D',
  segment: 'S',
  circle: 'C',
  polygon: 'B',
  arc: 'A',
  angle: 'G',
  tick: 'T',
  label: 'W',
};

function toolLabel(id: string): string {
  return TOOL_KEYS[id] ?? id.charAt(0).toUpperCase();
}

export function buildToolbar(opts: { editor: Editor; tools: ToolRegistry; fileInput: HTMLInputElement; onPolygon?: () => void; onPlugins?: () => void }): void {
  const { editor, tools, fileInput, onPolygon, onPlugins } = opts;
  const bar = document.querySelector<HTMLElement>('.toolbar');
  if (!bar) throw new Error('toolbar missing');

  const toolGroup = document.createElement('div');
  toolGroup.className = 'tool-group';
  bar.appendChild(toolGroup);

  const toolButtons = new Map<string, HTMLButtonElement>();
  const renderToolButtons = (): void => {
    toolGroup.innerHTML = '';
    toolButtons.clear();
    for (const tool of tools.list()) {
      const button = document.createElement('button');
      button.dataset.tool = tool.id;
      const label = tool.label ?? toolLabel(tool.id);
      button.textContent = label;
      button.title = `${tool.id} (${label})`;
      const onClick = tool.id === 'polygon' && onPolygon ? onPolygon : () => editor.setTool(tool.id);
      button.addEventListener('click', onClick);
      toolGroup.appendChild(button);
      toolButtons.set(tool.id, button);
    }
  };
  renderToolButtons();
  tools.onChange(renderToolButtons);

  const rule = document.createElement('span');
  rule.className = 'rule';
  bar.appendChild(rule);

  const action = (label: string, title: string, fn: () => void): void => {
    const button = document.createElement('button');
    button.textContent = label;
    button.title = title;
    button.addEventListener('click', fn);
    bar.appendChild(button);
  };

  action('X', 'Delete selected (X / Backspace)', () => editor.deleteSelected());
  action('Z', 'Undo (Z)', () => editor.undo());
  action('R', 'Redo (R)', () => editor.redo());
  action('E', 'Export JSON (E)', () => editor.exportScene());
  action('F', 'Export SVG (F)', () => editor.exportSVG());
  action('Q', 'Import JSON (Q)', () => fileInput.click());
  action('1', 'Toggle hidden (1)', () => editor.toggleHidden());
  action('EXT', 'Plugins', () => onPlugins?.());

  editor.onToolChange = (id) => {
    for (const [toolId, button] of toolButtons) button.classList.toggle('active', toolId === id);
  };
}
