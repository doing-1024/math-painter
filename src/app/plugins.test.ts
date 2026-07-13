import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginManager, type PluginManifest, type ModuleLoader } from './plugins';
import type { MathPainter } from '../core/extension';

interface Env {
  fetch: ReturnType<typeof vi.fn>;
  cacheStore: Map<string, string>;
  store: Map<string, string>;
}

function makeEnv(): Env {
  const store = new Map<string, string>();
  const cacheStore = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  const caches = {
    open: async () => ({
      put: async (url: string, res: { text: () => Promise<string> }) => {
        cacheStore.set(url, await res.text());
      },
      match: async (url: string) =>
        cacheStore.has(url) ? { text: async () => cacheStore.get(url)! } : undefined,
    }),
  };
  const list: PluginManifest[] = [
    { name: 'arrow', title: 'Arrow', description: 'arrow tool', version: '1.0.0', minApi: 1, entry: 'plugins/arrow/index.js' },
    { name: 'future', title: 'Future', description: 'needs newer api', version: '1.0.0', minApi: 2, entry: 'plugins/future/index.js' },
  ];
  const fetchMap = new Map<string, string>([
    ['https://ext.math-painter.pages.dev/plugins.json', JSON.stringify(list)],
    ['https://ext.math-painter.pages.dev/plugins/arrow/index.js', 'code-arrow'],
    ['https://third.example.com/p.js', 'code-third'],
  ]);
  const fetch = vi.fn(async (url: string) => {
    if (fetchMap.has(url)) return { ok: true, status: 200, text: async () => fetchMap.get(url)! };
    return { ok: false, status: 404, text: async () => '' };
  });
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('caches', caches);
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('confirm', () => true);
  return { fetch, cacheStore, store };
}

const mp: MathPainter = {
  apiVersion: 1,
  registerShape: vi.fn(),
  registerTool: vi.fn(),
  bindKey: vi.fn(),
};

describe('PluginManager', () => {
  beforeEach(() => makeEnv());
  afterEach(() => vi.unstubAllGlobals());

  it('fetches the official list and caches it', async () => {
    const manager = new PluginManager(mp);
    const list = await manager.fetchList();
    expect(list.map((m) => m.name)).toEqual(['arrow', 'future']);
    expect(manager.manifests).toHaveLength(2);
  });

  it('installs an official plugin via the injected loader and records it', async () => {
    const activated: MathPainter[] = [];
    const loader: ModuleLoader = async () => ({ default: (m) => activated.push(m) });
    const manager = new PluginManager(mp, loader);
    await manager.fetchList();
    await manager.installOfficial('arrow');
    expect(activated).toEqual([mp]);
    expect(manager.isInstalled('arrow')).toBe(true);
  });

  it('caches plugin code and reuses it offline on loadInstalled', async () => {
    const calls: MathPainter[] = [];
    const loader: ModuleLoader = async () => ({ default: (m) => calls.push(m) });
    const env = makeEnv();
    const manager = new PluginManager(mp, loader);
    await manager.fetchList();
    await manager.installOfficial('arrow');
    expect(calls).toHaveLength(1);
    // simulate offline for the plugin code, but keep the list reachable
    env.fetch.mockImplementation(async (url: string) =>
      url.endsWith('/plugins.json')
        ? { ok: true, status: 200, text: async () => JSON.stringify([{ name: 'arrow', title: 'Arrow', description: 'd', version: '1.0.0', minApi: 1, entry: 'plugins/arrow/index.js' }]) }
        : { ok: false, status: 404, text: async () => '' },
    );
    const manager2 = new PluginManager(mp, loader);
    await manager2.fetchList();
    await manager2.loadInstalled();
    expect(calls).toHaveLength(2);
  });

  it('refuses a plugin that needs a newer api', async () => {
    const manager = new PluginManager(mp);
    await manager.fetchList();
    await expect(manager.installOfficial('future')).rejects.toThrow(/api/i);
  });

  it('installs a third-party plugin from a URL', async () => {
    const calls: MathPainter[] = [];
    const loader: ModuleLoader = async () => ({ default: (m) => calls.push(m) });
    const manager = new PluginManager(mp, loader);
    await manager.installThirdParty('https://third.example.com/p.js', 'myplugin');
    expect(calls).toEqual([mp]);
    expect(manager.isInstalled('myplugin')).toBe(true);
  });

  it('uninstall removes a plugin from the enabled list', async () => {
    const loader: ModuleLoader = async () => ({ default: () => {} });
    const manager = new PluginManager(mp, loader);
    await manager.fetchList();
    await manager.installOfficial('arrow');
    expect(manager.isInstalled('arrow')).toBe(true);
    await manager.uninstall('arrow');
    expect(manager.isInstalled('arrow')).toBe(false);
  });
});
