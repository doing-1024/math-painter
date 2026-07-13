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
  /** Entry module path, relative to the official base. */
  entry: string;
  author?: string;
}

/** A cached/installed plugin record. `version` is the version we last loaded,
 *  used to detect available updates. */
export interface EnabledPlugin {
  name: string;
  version?: string;
}

export interface EnabledThirdParty extends EnabledPlugin {
  url: string;
}

export interface EnabledPlugins {
  official: EnabledPlugin[];
  thirdParty: EnabledThirdParty[];
}

/** An installed plugin whose version is older than (or unknown vs) the cloud
 *  version. `from` is undefined for legacy installs that predate version
 *  tracking. */
export interface PendingUpdate {
  name: string;
  from?: string;
  to: string;
  entry: string;
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

/** Lexicographic-ish semver compare: is `a` strictly newer than `b`? */
function versionGreater(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => Number(n) || 0);
  const pb = b.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

export class PluginManager {
  private list: PluginManifest[] = [];
  private pending: PendingUpdate[] = [];
  /** Notified whenever the set of pending updates changes, so the app can show
   *  or refresh a top-right update prompt. */
  onUpdates: ((pending: PendingUpdate[]) => void) | null = null;

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

  get pendingUpdates(): PendingUpdate[] {
    return this.pending;
  }

  isInstalled(name: string): boolean {
    const e = this.readEnabled();
    return e.official.some((x) => x.name === name) || e.thirdParty.some((t) => t.name === name);
  }

  /** Install an official plugin by id from the fetched list. User-initiated, so
   *  we fetch the fresh copy (network-first). */
  async installOfficial(name: string): Promise<void> {
    const m = this.list.find((x) => x.name === name);
    if (!m) throw new Error(`unknown plugin: ${name}`);
    if (m.minApi > this.mp.apiVersion) throw new Error(`needs api v${m.minApi}`);
    await this.installURL(`${this.officialBase}/${m.entry}`, m.name, true, m.version, false);
  }

  /** Install a third-party plugin from an arbitrary URL. The user is warned
   *  that third-party code runs with full page privileges. */
  async installThirdParty(url: string, name?: string): Promise<void> {
    if (!confirm('第三方插件会以任意代码运行，仅从可信来源安装。确定继续？')) {
      throw new Error('cancelled');
    }
    await this.installURL(url, name?.trim() || url, false, undefined, false);
  }

  private async installURL(
    url: string,
    name: string,
    official: boolean,
    version: string | undefined,
    preferCache: boolean,
  ): Promise<void> {
    // Start from the local cache for a fast, offline-friendly load; otherwise
    // fetch over the network and cache the result.
    let code: string | null = preferCache ? await this.cacheGet(url) : null;
    if (code == null) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          code = await res.text();
          await this.cachePut(url, code);
        }
      } catch {
        /* offline: fall back to cache below */
      }
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
    this.recordEnabled(name, url, official, version);
  }

  /** Re-activate every installed plugin from the local cache (fast path, works
   *  offline). Runs at startup before any network round-trip for updates. */
  async loadInstalled(): Promise<void> {
    const enabled = this.readEnabled();
    for (const rec of enabled.official) {
      const m = this.list.find((x) => x.name === rec.name);
      if (!m) continue;
      try {
        await this.installURL(`${this.officialBase}/${m.entry}`, rec.name, true, rec.version, true);
      } catch (error) {
        console.error('[math-painter] plugin load failed', rec.name, error);
      }
    }
    for (const t of enabled.thirdParty) {
      try {
        await this.installURL(t.url, t.name, false, t.version, true);
      } catch (error) {
        console.error('[math-painter] plugin load failed', t.name, error);
      }
    }
  }

  /** Non-blocking: compare installed official plugins against the cloud list and
   *  collect any with a newer version. Fires `onUpdates` when something is
   *  available (so the app can show a top-right prompt). Swallows failures
   *  (offline / list unreachable) — no prompt in that case. */
  async checkUpdates(): Promise<PendingUpdate[]> {
    try {
      const list = this.list.length ? this.list : await this.fetchList();
      const enabled = this.readEnabled();
      const pending: PendingUpdate[] = [];
      for (const rec of enabled.official) {
        const m = list.find((x) => x.name === rec.name);
        // Update when the cloud is newer, or when the installed version is
        // unknown (legacy installs before version tracking existed) so those
        // users still receive fixes.
        if (m && (rec.version === undefined || versionGreater(m.version, rec.version))) {
          pending.push({ name: rec.name, from: rec.version, to: m.version, entry: m.entry });
        }
      }
      this.pending = pending;
      this.onUpdates?.(pending);
    } catch {
      /* offline or list unreachable: no update prompt */
    }
    return this.pending;
  }

  /** Download and re-activate the latest version of an installed plugin (hot
   *  reload: the new shape/tool registration replaces the old one and the
   *  toolbar redraws via `tools.onChange`). Removes it from the pending list
   *  and notifies the UI. */
  async updatePlugin(name: string): Promise<void> {
    const m = this.list.find((x) => x.name === name);
    if (!m) throw new Error(`unknown plugin: ${name}`);
    await this.installURL(`${this.officialBase}/${m.entry}`, m.name, true, m.version, false);
    this.pending = this.pending.filter((p) => p.name !== name);
    this.onUpdates?.(this.pending);
  }

  /** Remove a plugin from the enabled list (and drop its cached code). The
   *  already-activated code stays in memory for the current session; a reload
   *  finishes the uninstall. */
  async uninstall(name: string): Promise<void> {
    const enabled = this.readEnabled();
    const url = enabled.thirdParty.find((t) => t.name === name)?.url;
    enabled.official = enabled.official.filter((x) => x.name !== name);
    enabled.thirdParty = enabled.thirdParty.filter((t) => t.name !== name);
    this.writeEnabled(enabled);
    this.pending = this.pending.filter((p) => p.name !== name);
    this.onUpdates?.(this.pending);
    if (url) {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(url);
    }
  }

  private recordEnabled(name: string, url: string, official: boolean, version: string | undefined): void {
    const enabled = this.readEnabled();
    if (official) {
      const rec: EnabledPlugin = { name, version };
      const i = enabled.official.findIndex((x) => x.name === name);
      if (i >= 0) enabled.official[i] = rec;
      else enabled.official.push(rec);
    } else {
      const rec: EnabledThirdParty = { name, url, version };
      const i = enabled.thirdParty.findIndex((t) => t.url === url);
      if (i >= 0) enabled.thirdParty[i] = rec;
      else enabled.thirdParty.push(rec);
    }
    this.writeEnabled(enabled);
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
      const raw = JSON.parse(localStorage.getItem(ENABLED_KEY) ?? '{"official":[],"thirdParty":[]}');
      // Tolerate the older string[] shape so existing installs keep working.
      const official = Array.isArray(raw.official)
        ? raw.official.map((x: unknown) =>
            typeof x === 'string'
              ? { name: x }
              : { name: (x as { name: string }).name, version: (x as { name: string; version?: string }).version },
          )
        : [];
      const thirdParty = Array.isArray(raw.thirdParty)
        ? raw.thirdParty.map((x: EnabledThirdParty) => ({ name: x.name, url: x.url, version: x.version }))
        : [];
      return { official, thirdParty };
    } catch {
      return { official: [], thirdParty: [] };
    }
  }

  private writeEnabled(enabled: EnabledPlugins): void {
    localStorage.setItem(ENABLED_KEY, JSON.stringify(enabled));
  }
}
