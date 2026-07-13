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
    ['https://mp-ext.doi.l.cd/plugins.json', JSON.stringify(list)],
    ['https://mp-ext.doi.l.cd/plugins/arrow/index.js', 'code-arrow'],
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
  setFormulaRenderer: vi.fn(),
  renderSVG: vi.fn(() => '<svg/>'),
  renderCanvas: vi.fn(() => null),
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

  it('loads from cache first so startup is fast and offline-friendly', async () => {
    const env = makeEnv();
    const calls: MathPainter[] = [];
    const loader: ModuleLoader = async () => ({ default: (m) => calls.push(m) });
    const manager = new PluginManager(mp, loader);
    await manager.fetchList();
    await manager.installOfficial('arrow'); // network + cache
    // Simulate a fully offline reload: network fetches fail, but the list and
    // plugin code were already cached by the first session.
    env.fetch.mockImplementation(async () => ({ ok: false, status: 404, text: async () => '' }));
    const manager2 = new PluginManager(mp, loader);
    await manager2.fetchList(); // network fails -> falls back to cached list
    await manager2.loadInstalled(); // must succeed from cache
    expect(calls).toHaveLength(2);
  });

  it('checkUpdates reports nothing when versions match', async () => {
    const manager = new PluginManager(mp, async () => ({ default: () => {} }));
    await manager.fetchList();
    await manager.installOfficial('arrow');
    expect(await manager.checkUpdates()).toEqual([]);
    expect(manager.pendingUpdates).toEqual([]);
  });

  it('checkUpdates prompts legacy installs that have no recorded version', async () => {
    const manager = new PluginManager(mp, async () => ({ default: () => {} }));
    await manager.fetchList();
    localStorage.setItem('math-painter:plugins', JSON.stringify({ official: ['arrow'], thirdParty: [] }));
    const pending = await manager.checkUpdates();
    expect(pending).toEqual([{ name: 'arrow', from: undefined, to: '1.0.0', entry: 'plugins/arrow/index.js' }]);
  });

  it('checkUpdates detects a newer cloud version and updatePlugin re-activates', async () => {
    const loader: ModuleLoader = async () => ({ default: () => {} });
    const env = makeEnv();
    const manager = new PluginManager(mp, loader);
    await manager.fetchList(); // list = 1.0.0
    await manager.installOfficial('arrow'); // records 1.0.0
    // Cloud upgrades to 1.0.1.
    env.fetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/plugins.json')) {
        return { ok: true, status: 200, text: async () => JSON.stringify([{ name: 'arrow', title: 'Arrow', description: 'd', version: '1.0.1', minApi: 1, entry: 'plugins/arrow/index.js' }]) };
      }
      if (url === 'https://mp-ext.doi.l.cd/plugins/arrow/index.js') {
        return { ok: true, status: 200, text: async () => 'code-arrow' };
      }
      return { ok: false, status: 404, text: async () => '' };
    });
    await manager.fetchList(); // this.list now 1.0.1
    const onUpdates = vi.fn();
    manager.onUpdates = onUpdates;
    const pending = await manager.checkUpdates();
    expect(pending).toEqual([{ name: 'arrow', from: '1.0.0', to: '1.0.1', entry: 'plugins/arrow/index.js' }]);
    expect(onUpdates).toHaveBeenCalledWith(pending);
    await manager.updatePlugin('arrow');
    expect(manager.pendingUpdates).toEqual([]);
    const enabled = JSON.parse(localStorage.getItem('math-painter:plugins') ?? '{}');
    expect(enabled.official[0]).toEqual({ name: 'arrow', version: '1.0.1' });
  });
});
