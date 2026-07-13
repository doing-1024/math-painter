import type { MathPainter } from '../core/extension';

/** Default source for the official plugin list. Users behind a slow network
 *  can repoint this to a mirror via the `math-painter:plugin-base` setting. */
const DEFAULT_OFFICIAL_BASE = 'https://mp-ext.doi.l.cd';
const BASE_KEY = 'math-painter:plugin-base';
const ENABLED_KEY = 'math-painter:plugins';
const CACHE_NAME = 'math-painter:plugins';

export interface PluginManifest {
  /** Stable plugin id, also used as the install key. */
  name: string;
  title: string;
  description: string;
  version: string;
  /** Minimum `apiVersion` this plugin requires. */
  minApi: number;
  /** Entry module path, relative to the official base (e.g. plugins/arrow/index.js). */
  entry: string;
  author?: string;
}

export interface EnabledPlugins {
  official: string[];
  thirdParty: { name: string; url: string }[];
}

/** Turns fetched plugin source into an evaluable module. Injected so tests can
 *  stub it; the default builds a Blob URL and dynamically imports it. */
export type ModuleLoader = (code: string) => Promise<{ default?: (mp: MathPainter) => void }>;

const defaultLoader: ModuleLoader = async (code) => {
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    return await import(/* @vite-ignore */ url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

export class PluginManager {
  private list: PluginManifest[] = [];

  constructor(
    private readonly mp: MathPainter,
    private readonly loadModule: ModuleLoader = defaultLoader,
  ) {}

  /** Official list base URL (defaults to Cloudflare Pages; overridable). */
  get officialBase(): string {
    return localStorage.getItem(BASE_KEY) ?? DEFAULT_OFFICIAL_BASE;
  }

  setOfficialBase(url: string): void {
    localStorage.setItem(BASE_KEY, url);
  }

  /** Fetch the official plugin list (network first, cached copy as fallback so
   *  an offline reload can still resolve already-installed official plugins). */
  async fetchList(): Promise<PluginManifest[]> {
    const url = `${this.officialBase}/plugins.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`list ${res.status}`);
      const text = await res.text();
      await this.cachePut(url, text);
      this.list = JSON.parse(text) as PluginManifest[];
    } catch {
      const cached = await this.cacheGet(url);
      if (cached) this.list = JSON.parse(cached) as PluginManifest[];
    }
    return this.list;
  }

  get manifests(): PluginManifest[] {
    return this.list;
  }

  isInstalled(name: string): boolean {
    const e = this.readEnabled();
    return e.official.includes(name) || e.thirdParty.some((t) => t.name === name);
  }

  /** Install an official plugin by id from the fetched list. */
  async installOfficial(name: string): Promise<void> {
    const m = this.list.find((x) => x.name === name);
    if (!m) throw new Error(`unknown plugin: ${name}`);
    if (m.minApi > this.mp.apiVersion) throw new Error(`needs api v${m.minApi}`);
    await this.installURL(`${this.officialBase}/${m.entry}`, m.name, true);
  }

  /** Install a third-party plugin from an arbitrary URL. The user is warned
   *  that third-party code runs with full page privileges. */
  async installThirdParty(url: string, name?: string): Promise<void> {
    if (!confirm('第三方插件会以任意代码运行，仅从可信来源安装。确定继续？')) {
      throw new Error('cancelled');
    }
    await this.installURL(url, name?.trim() || url, false);
  }

  private async installURL(url: string, name: string, official: boolean): Promise<void> {
    // Network-first: always try to fetch the latest plugin code (so updates
    // propagate), and only fall back to the cached copy when offline.
    let code: string | null = null;
    try {
      const res = await fetch(url);
      if (res.ok) {
        code = await res.text();
        await this.cachePut(url, code);
      }
    } catch {
      /* offline: fall back to cache below */
    }
    if (code == null) code = await this.cacheGet(url);
    if (code == null) throw new Error(`cannot load ${url}`);
    // Tell bundled plugins where their external assets live (e.g. KaTeX
    // CSS/fonts). Read once at module top-level, so set it before importing.
    const base = official ? this.officialBase : new URL(url).origin;
    (globalThis as { __MP_EXT_BASE__?: string }).__MP_EXT_BASE__ = base;
    const mod = await this.loadModule(code);
    if (typeof mod.default !== 'function') throw new Error('plugin has no default export');
    mod.default(this.mp);
    const enabled = this.readEnabled();
    if (official) {
      if (!enabled.official.includes(name)) enabled.official.push(name);
    } else if (!enabled.thirdParty.some((t) => t.url === url)) {
      enabled.thirdParty.push({ name, url });
    }
    this.writeEnabled(enabled);
  }

  /** Re-activate every installed plugin (called once at startup). Plugin code
   *  is served from the local cache when available, so this works offline. */
  async loadInstalled(): Promise<void> {
    const enabled = this.readEnabled();
    for (const name of enabled.official) {
      const m = this.list.find((x) => x.name === name);
      if (!m) continue;
      try {
        await this.installURL(`${this.officialBase}/${m.entry}`, name, true);
      } catch (error) {
        console.error('[math-painter] plugin load failed', name, error);
      }
    }
    for (const t of enabled.thirdParty) {
      try {
        await this.installURL(t.url, t.name, false);
      } catch (error) {
        console.error('[math-painter] plugin load failed', t.name, error);
      }
    }
  }

  /** Remove a plugin from the enabled list (and drop its cached code). The
   *  already-activated code stays in memory for the current session; a reload
   *  finishes the uninstall. */
  async uninstall(name: string): Promise<void> {
    const enabled = this.readEnabled();
    const url = enabled.thirdParty.find((t) => t.name === name)?.url;
    enabled.official = enabled.official.filter((n) => n !== name);
    enabled.thirdParty = enabled.thirdParty.filter((t) => t.name !== name);
    this.writeEnabled(enabled);
    if (url) {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(url);
    }
  }

  private async cachePut(url: string, code: string): Promise<void> {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, new Response(code, { headers: { 'content-type': 'text/javascript' } }));
  }

  private async cacheGet(url: string): Promise<string | null> {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    return hit ? await hit.text() : null;
  }

  private readEnabled(): EnabledPlugins {
    try {
      return JSON.parse(localStorage.getItem(ENABLED_KEY) ?? '{"official":[],"thirdParty":[]}') as EnabledPlugins;
    } catch {
      return { official: [], thirdParty: [] };
    }
  }

  private writeEnabled(enabled: EnabledPlugins): void {
    localStorage.setItem(ENABLED_KEY, JSON.stringify(enabled));
  }
}
