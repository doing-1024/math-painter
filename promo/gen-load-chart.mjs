// Generates a load-speed comparison bar chart (initial transfer size, gzip KB)
// on a log scale. math-painter's figure is the real build output; competitor
// figures are order-of-magnitude public estimates (see footnote) and must be
// verified before publishing.
import { writeFileSync, mkdirSync } from 'node:fs';

// name, gzip KB (initial transfer), isOurs, note
const data = [
  { name: 'math-painter', kb: 19, ours: true },
  { name: 'Excalidraw', kb: 450, ours: false },
  { name: 'tldraw', kb: 600, ours: false },
  { name: 'Desmos', kb: 1500, ours: false },
  { name: 'draw.io', kb: 2500, ours: false },
  { name: 'GeoGebra', kb: 3500, ours: false },
];

const W = 780;
const H = 480;
const ML = 64; // left margin
const MR = 24;
const MT = 64; // top
const MB = 96; // bottom
const plotW = W - ML - MR;
const plotH = H - MT - MB;
const yMin = 10; // 10^1
const yMax = 10000; // 10^4
const lMin = Math.log10(yMin);
const lMax = Math.log10(yMax);
const yFor = (kb) => MT + ((lMax - Math.log10(kb)) / (lMax - lMin)) * plotH;

const svgNS = '';
const bars = [];
const n = data.length;
const slot = plotW / n;
const bw = Math.min(72, slot * 0.62);
data.forEach((d, i) => {
  const cx = ML + slot * (i + 0.5);
  const x = cx - bw / 2;
  const yTop = yFor(d.kb);
  const yBot = yFor(yMin);
  const h = yBot - yTop;
  const fill = d.ours ? '#0a8a0a' : '#9aa0a6';
  bars.push(`  <rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${fill}"/>`);
  // value label
  bars.push(`  <text x="${cx.toFixed(1)}" y="${(yTop - 8).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="600" fill="#202124">${d.kb >= 1000 ? (d.kb / 1000).toFixed(1) + ' MB' : d.kb + ' KB'}</text>`);
  // category label (two lines for long names)
  const label = d.name;
  bars.push(`  <text x="${cx.toFixed(1)}" y="${(yBot + 22).toFixed(1)}" text-anchor="middle" font-size="13" fill="#202124" font-weight="${d.ours ? 700 : 400}">${label}</text>`);
  if (d.ours) {
    bars.push(`  <text x="${cx.toFixed(1)}" y="${(yBot + 40).toFixed(1)}" text-anchor="middle" font-size="11" fill="#0a8a0a">实测</text>`);
  } else {
    bars.push(`  <text x="${cx.toFixed(1)}" y="${(yBot + 40).toFixed(1)}" text-anchor="middle" font-size="11" fill="#9aa0a6">≈ 量级</text>`);
  }
});

// y gridlines at decades
const grids = [];
for (let p = 1; p <= 4; p++) {
  const val = 10 ** p;
  const y = yFor(val);
  grids.push(`  <line x1="${ML}" y1="${y.toFixed(1)}" x2="${(W - MR).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e6e6e6" stroke-width="1"/>`);
  grids.push(`  <text x="${(ML - 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#80868b">${val >= 1000 ? val / 1000 + 'MB' : val + 'KB'}</text>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${ML}" y="28" font-size="17" font-weight="700" fill="#202124">首屏传输体积对比（gzip，对数刻度）</text>
  <text x="${ML}" y="48" font-size="12" fill="#80868b">加载速度的主要决定因素 · math-painter 为构建产物实测，竞品为公开资料量级估算</text>
  ${grids.join('\n')}
  <line x1="${ML}" y1="${MT}" x2="${ML}" y2="${yFor(yMin)}" stroke="#cfcfcf" stroke-width="1"/>
  ${bars.join('\n')}
  <text x="${ML}" y="${(H - 14)}" font-size="10.5" fill="#9aa0a6">注：竞品数值为初始首屏传输体积（gzip）的量级估算，非本机实测；math-painter = JS 17.5KB + CSS 1.45KB gzip，0 运行时依赖。</text>
</svg>
`;

mkdirSync('promo', { recursive: true });
writeFileSync('promo/load-compare.svg', svg);
console.log('wrote promo/load-compare.svg');

// ASCII preview for the forum (linear-ish, heights by log10)
const maxLog = lMax;
const minLog = lMin;
console.log('\nASCII preview:');
for (const d of data) {
  const len = Math.max(1, Math.round(((Math.log10(d.kb) - minLog) / (maxLog - minLog)) * 40));
  const bar = (d.ours ? '█' : '▒').repeat(len);
  console.log(`${d.name.padEnd(12)} ${bar} ${d.kb >= 1000 ? (d.kb / 1000).toFixed(1) + 'MB' : d.kb + 'KB'}`);
}
