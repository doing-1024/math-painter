import './styles.css';
import './core/shapes';
import { Editor } from './app/editor';
import { CanvasRenderer } from './render/renderer';
import { InputController } from './app/input';
import { buildToolbar } from './app/toolbar';
import { ToolRegistry } from './tools/registry';
import { registerCoreTools } from './tools';

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

buildToolbar({ editor, tools, fileInput, onPolygon: () => input.choosePolygon() });
input.attach();

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (file) await editor.importScene(file);
  fileInput.value = '';
});

new ResizeObserver(() => editor.measure()).observe(canvas);

editor.setTool('select');
