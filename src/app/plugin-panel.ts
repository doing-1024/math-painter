import type { PluginManager, PendingUpdate } from './plugins';

/** Open the plugin panel: an in-page modal listing official plugins (with
 *  one-click install/uninstall) and an import box for third-party plugins. */
export function openPluginPanel(manager: PluginManager): void {
  document.getElementById('plugin-panel')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'plugin-panel';
  overlay.id = 'plugin-panel';

  const close = (): void => overlay.remove();
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });

  const inner = document.createElement('div');
  inner.className = 'plugin-panel-inner';
  overlay.appendChild(inner);

  const header = document.createElement('div');
  header.className = 'plugin-panel-head';
  header.innerHTML = `<span>插件 Plugins</span>`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'plugin-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', close);
  header.appendChild(closeBtn);
  inner.appendChild(header);

  const status = document.createElement('div');
  status.className = 'plugin-status';
  inner.appendChild(status);

  const official = document.createElement('div');
  official.className = 'plugin-section';
  official.innerHTML = `<h3>官方插件 Official</h3>`;
  const grid = document.createElement('div');
  grid.className = 'plugin-grid';
  official.appendChild(grid);
  inner.appendChild(official);

  const third = document.createElement('div');
  third.className = 'plugin-section';
  third.innerHTML = `<h3>导入第三方 Import third-party</h3>`;
  const row = document.createElement('div');
  row.className = 'plugin-import';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'prompt-input';
  input.placeholder = '插件入口 URL（如 https://.../index.js）';
  const importBtn = document.createElement('button');
  importBtn.textContent = '导入';
  row.appendChild(input);
  row.appendChild(importBtn);
  const warn = document.createElement('div');
  warn.className = 'plugin-warn';
  warn.textContent = '第三方插件以任意代码运行，仅从可信来源导入。';
  third.appendChild(row);
  third.appendChild(warn);
  inner.appendChild(third);

  document.body.appendChild(overlay);

  const render = (): void => {
    grid.innerHTML = '';
    for (const m of manager.manifests) {
      const card = document.createElement('div');
      card.className = 'plugin-card';
      const installed = manager.isInstalled(m.name);
      const pending = manager.pendingUpdates.find((p) => p.name === m.name);
      card.innerHTML = `
        <div class="plugin-name">${escapeHtml(m.title)} <span class="plugin-ver">v${escapeHtml(m.version)}</span></div>
        <div class="plugin-desc">${escapeHtml(m.description)}</div>
        <div class="plugin-meta">${escapeHtml(m.author ?? 'official')} · api≥${m.minApi}</div>`;
      if (installed && pending) {
        const up = document.createElement('button');
        up.className = 'plugin-btn plugin-update';
        up.textContent = `更新${pending.from ? ` v${escapeHtml(pending.from)}` : ''} → v${escapeHtml(pending.to)}`;
        up.addEventListener('click', async () => {
          up.disabled = true;
          try {
            await manager.updatePlugin(m.name);
            status.textContent = `已更新 ${m.name} 到 v${escapeHtml(pending.to)}`;
          } catch (error) {
            status.textContent = `错误：${error instanceof Error ? error.message : String(error)}`;
            up.disabled = false;
          }
          render();
        });
        card.appendChild(up);
      } else {
        const btn = document.createElement('button');
        btn.className = 'plugin-btn';
        btn.textContent = installed ? '卸载' : '安装';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            if (installed) {
              await manager.uninstall(m.name);
              status.textContent = `已卸载 ${m.name}（刷新后完全移除）`;
            } else {
              await manager.installOfficial(m.name);
              status.textContent = `已安装 ${m.name}`;
            }
            render();
          } catch (error) {
            status.textContent = `错误：${error instanceof Error ? error.message : String(error)}`;
            btn.disabled = false;
          }
        });
        card.appendChild(btn);
      }
      grid.appendChild(card);
    }
  };

  importBtn.addEventListener('click', async () => {
    const url = input.value.trim();
    if (!url) return;
    importBtn.disabled = true;
    try {
      await manager.installThirdParty(url);
      status.textContent = `已导入 ${url}`;
      input.value = '';
    } catch (error) {
      status.textContent = `错误：${error instanceof Error ? error.message : String(error)}`;
    } finally {
      importBtn.disabled = false;
    }
  });

  void manager
    .fetchList()
    .then(() => {
      if (!manager.manifests.length) status.textContent = '未能加载官方插件列表（离线或源不可达）。';
      render();
    })
    .catch(() => {
      status.textContent = '未能加载官方插件列表（离线或源不可达）。';
      render();
    });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

/** Names the user chose to ignore this session, so the toast stops nagging
 *  without uninstalling or persisting the dismissal. */
const dismissed = new Set<string>();

/** Render the top-right update toast. Called whenever the set of pending
 *  updates changes; passing an empty list removes the toast. `onUpdate` runs
 *  when the user confirms an update from the toast. */
export function renderUpdateToast(pending: PendingUpdate[], onUpdate: (name: string) => void): void {
  const existing = document.getElementById('plugin-toast');
  const visible = pending.filter((p) => !dismissed.has(p.name));
  if (!visible.length) {
    existing?.remove();
    return;
  }
  const toast = existing ?? (() => {
    const el = document.createElement('div');
    el.id = 'plugin-toast';
    document.body.appendChild(el);
    return el;
  })();
  toast.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'plugin-toast-head';
  head.textContent = '插件更新可用';
  toast.appendChild(head);
  for (const p of visible) {
    const row = document.createElement('div');
    row.className = 'plugin-toast-row';
    const text = document.createElement('span');
    text.textContent = `${p.name}${p.from ? `  v${p.from}` : ''} → v${p.to}`;
    const upd = document.createElement('button');
    upd.className = 'plugin-toast-btn';
    upd.textContent = '更新';
    upd.addEventListener('click', () => onUpdate(p.name));
    const ignore = document.createElement('button');
    ignore.className = 'plugin-toast-btn plugin-toast-ignore';
    ignore.textContent = '忽略';
    ignore.addEventListener('click', () => {
      dismissed.add(p.name);
      renderUpdateToast(pending, onUpdate);
    });
    row.append(text, upd, ignore);
    toast.appendChild(row);
  }
}
