import './styles.css';
import './core/shapes';
import { Editor } from './app/editor';
import { CanvasRenderer } from './render/renderer';
import { InputController } from './app/input';
import { buildToolbar } from './app/toolbar';
import { ToolRegistry } from './tools/registry';
import { registerCoreTools } from './tools';
import { createMathPainter } from './app/extension';
import { PluginManager } from './app/plugins';
import { openPluginPanel } from './app/plugin-panel';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('missing app root');

app.innerHTML = `
  <main class="shell">
    <aside class="toolbar" aria-label="tools"></aside>
    <section class="stage">
      <canvas id="canvas"></canvas>
      <div class="status" id="status"></div>
    </section>
    <input id="file" type="file" accept="application/json" hidden />
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
const statusEl = document.querySelector<HTMLElement>('#status');
const fileInput = document.querySelector<HTMLInputElement>('#file');
if (!canvas || !statusEl || !fileInput) throw new Error('missing ui nodes');

const tools = new ToolRegistry();
registerCoreTools(tools);

const renderer = new CanvasRenderer(canvas);
const editor = new Editor(tools, renderer, statusEl);
const input = new InputController(canvas, editor, () => canvas.getBoundingClientRect(), fileInput);

const mathPainter = createMathPainter(tools, input);
const plugins = new PluginManager(mathPainter);
buildToolbar({
  editor,
  tools,
  fileInput,
  onPolygon: () => input.choosePolygon(),
  onPlugins: () => openPluginPanel(plugins),
});
input.attach();

// Load the official list + re-activate installed plugins. Fire-and-forget:
// plugins are optional and must never block the core from starting.
tools.onChange(() => editor.draw());
void plugins.fetchList().then(() => plugins.loadInstalled()).catch((error) => {
  console.error('[math-painter] plugin init failed', error);
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (file) await editor.importScene(file);
  fileInput.value = '';
});

new ResizeObserver(() => editor.measure()).observe(canvas);

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === '`' && !(event.ctrlKey || event.metaKey || event.altKey)) {
    event.preventDefault();
    openPluginPanel(plugins);
  }
});

editor.setTool('select');
