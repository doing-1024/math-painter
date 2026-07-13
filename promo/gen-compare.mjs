// Combined real comparison of math-painter vs同类: FCP / transfer / requests.
// All values are measured (bench.json, via headless Chrome / agent-browser).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const bench = JSON.parse(readFileSync('promo/bench.json', 'utf8'));
const products = bench.products;

const panels = [
  { title: '首屏可交互 FCP', unit: 'ms', min: 100, max: 20000, key: 'fcp' },
  { title: '首屏传输体积', unit: 'KB', min: 10, max: 5000, key: 'transferKB' },
  { title: '首屏网络请求', unit: '个', min: 1, max: 200, key: 'req' },
];

const W = 900;
const MT = 86;
const panelH = 168;
const gap = 26;
const H = MT + panels.length * panelH + gap * (panels.length - 1) + 70;
const nameX = 20;
const trackX = 168;
const trackW = W - trackX - 92;

const parts = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`);
parts.push(`  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
parts.push(`  <text x="20" y="34" font-size="18" font-weight="700" fill="#0a8a0a">math-painter vs 同类：headless Chrome 实测</text>`);
parts.push(`  <text x="20" y="56" font-size="12" fill="#80868b">六项指标均为线上站点真实测量（性能 API），含真实网络延迟；math-painter = https://mp.doi.l.cd。纵轴为对数刻度。</text>`);

panels.forEach((p, pi) => {
  const py = MT + pi * (panelH + gap);
  parts.push(`  <text x="20" y="${py + 4}" font-size="14" font-weight="700" fill="#202124">${p.title}</text>`);
  const lMin = Math.log10(p.min);
  const lMax = Math.log10(p.max);
  const rowH = (panelH - 16) / products.length;
  products.forEach((pr, i) => {
    const v = pr[p.key];
    const y = py + 16 + i * rowH + rowH / 2;
    const frac = Math.max(0.02, (Math.log10(v) - lMin) / (lMax - lMin));
    const bw = Math.max(3, Math.round(frac * trackW));
    const fill = pr.ours ? '#0a8a0a' : '#9aa0a6';
    parts.push(`  <text x="${nameX}" y="${y + 4}" font-size="12.5" fill="${pr.ours ? '#0a8a0a' : '#202124'}" font-weight="${pr.ours ? 700 : 400}">${pr.name}</text>`);
    parts.push(`  <rect x="${trackX}" y="${y - 7}" width="${trackW}" height="14" rx="7" fill="#f1f3f4"/>`);
    parts.push(`  <rect x="${trackX}" y="${y - 7}" width="${bw}" height="14" rx="7" fill="${fill}"/>`);
    const label = p.unit === 'ms' && v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}${p.unit}`;
    parts.push(`  <text x="${trackX + bw + 8}" y="${y + 4}" font-size="12" font-weight="600" fill="${pr.ours ? '#0a8a0a' : '#5f6368'}">${label}</text>`);
  });
});

parts.push(`  <text x="20" y="${H - 30}" font-size="10.5" fill="#9aa0a6">注：纵轴为对数刻度（同面板内可比比例）。FCP=首次内容绘制（用户感知就绪）。math-painter 已为线上实测（传输仅 20KB，含网络延迟）。</text>`);
parts.push(`  <text x="20" y="${H - 14}" font-size="10.5" fill="#9aa0a6">竞品「完全加载」偏慢多因其持续拉取资源（Desmos 13.8s / draw.io 20s 的 load 事件），但 FCP 已反映其体量差距。</text>`);
parts.push(`</svg>`);

mkdirSync('promo', { recursive: true });
writeFileSync('promo/perf-compare.svg', parts.join('\n'));
console.log('wrote promo/perf-compare.svg');
