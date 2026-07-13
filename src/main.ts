import './styles.css';
import './core/shapes';
import { Editor } from './app/editor';
import { LabelLayer } from './app/label-layer';
import { CanvasRenderer } from './render/renderer';
import { InputController } from './app/input';
import { buildToolbar } from './app/toolbar';
import { ToolRegistry } from './tools/registry';
import { registerCoreTools } from './tools';
import { createMathPainter } from './app/extension';
import { PluginManager } from './app/plugins';
import { openPluginPanel, renderUpdateToast } from './app/plugin-panel';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('missing app root');

app.innerHTML = `
  <main class="shell">
    <aside class="toolbar" aria-label="tools"></aside>
    <section class="stage">
      <canvas id="canvas"></canvas>
      <div class="labels" id="labels"></div>
      <div class="status" id="status"></div>
    </section>
    <input id="file" type="file" accept="application/json" hidden />
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
const labelsEl = document.querySelector<HTMLElement>('#labels');
const statusEl = document.querySelector<HTMLElement>('#status');
const fileInput = document.querySelector<HTMLInputElement>('#file');
if (!canvas || !labelsEl || !statusEl || !fileInput) throw new Error('missing ui nodes');

const tools = new ToolRegistry();
registerCoreTools(tools);

const renderer = new CanvasRenderer(canvas);
const labelLayer = new LabelLayer(labelsEl);
const editor = new Editor(tools, renderer, statusEl, labelLayer);
const input = new InputController(canvas, editor, () => canvas.getBoundingClientRect(), fileInput);

const mathPainter = createMathPainter(tools, input, editor);
const plugins = new PluginManager(mathPainter);
plugins.onUpdates = (pending) => {
  renderUpdateToast(pending, (name) => {
    void plugins
      .updatePlugin(name)
      .then(() => {
        if (editor.activeTool.id === name) editor.setTool(name);
        else editor.draw();
      })
      .catch((error) => console.error('[math-painter] plugin update failed', name, error));
  });
};
buildToolbar({
  editor,
  tools,
  fileInput,
  onPolygon: () => input.choosePolygon(),
  onPlugins: () => openPluginPanel(plugins),
});
input.attach();

// Load the official list, re-activate installed plugins from cache (fast,
// offline-friendly), then check for updates in the background without blocking
// the core from starting.
tools.onChange(() => editor.draw());
void plugins
  .fetchList()
  .then(() => plugins.loadInstalled())
  .then(() => void plugins.checkUpdates())
  .catch((error) => {
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
