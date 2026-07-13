import puppeteer from 'puppeteer-core';

const URL = 'http://127.0.0.1:4173/';
const EXEC = '/usr/bin/google-chrome-stable';

const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const errors = [];
async function measure(label) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: 1000, height: 700 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint');
    const resources = performance.getEntriesByType('resource');
    const transfer =
      resources.reduce((s, r) => s + (r.transferSize || 0), 0) + (nav.transferSize || 0);
    const scripts = resources.filter((r) => r.initiatorType === 'script').length;
    const styles = resources.filter((r) => r.initiatorType === 'link').length;
    const mem = performance.memory ? performance.memory.usedJSHeapSize : null;
    return {
      fcp: fcp ? Math.round(fcp.startTime) : null,
      dcl: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      requests: resources.length + 1,
      scripts,
      styles,
      transferKB: +(transfer / 1024).toFixed(1),
      memMB: mem ? +(mem / 1048576).toFixed(1) : null,
    };
  });
  await ctx.close();
  return { label, ...data, wallMs: Date.now() - t0 };
}

const cold = await measure('cold');

// Warm load (cache enabled) for comparison
const warmCtx = await browser.createBrowserContext();
const warmPage = await warmCtx.newPage();
await warmPage.setViewport({ width: 1000, height: 700 });
await warmPage.goto(URL, { waitUntil: 'load' });
const warm = await warmPage.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');
  const fcp = paint.find((p) => p.name === 'first-contentful-paint');
  return { fcp: fcp ? Math.round(fcp.startTime) : null, load: Math.round(nav.loadEventEnd) };
});

// Memory scaling: draw 50 points, measure heap before/after
await warmPage.keyboard.press('d'); // point tool
const before = await warmPage.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : null));
for (let i = 0; i < 50; i++) {
  await warmPage.mouse.click(300 + (i % 25) * 12, 220 + Math.floor(i / 25) * 60);
  await warmPage.keyboard.press('Escape'); // dismiss the label prompt
}
await new Promise((r) => setTimeout(r, 300));
const after = await warmPage.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : null));
await warmCtx.close();

await browser.close();

const out = {
  cold,
  warm,
  memBaselineMB: cold.memMB,
  memAfter50ShapesMB: after ? +(after / 1048576).toFixed(1) : null,
  memDelta50ShapesMB: before && after ? +((after - before) / 1048576).toFixed(2) : null,
  consoleErrors: errors,
};
import { writeFileSync } from 'node:fs';
writeFileSync('promo/metrics.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
