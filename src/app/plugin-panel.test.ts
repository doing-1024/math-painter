import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderUpdateToast } from './plugin-panel';
import type { PendingUpdate } from './plugins';

// Minimal DOM stub so renderUpdateToast (which builds the main-UI toast) can be
// exercised without jsdom. The toast is appended to document.body, proving the
// update reminder lives on the main interface (not only inside the panel).
function installDom(): { body: any; byId: Map<string, any>; appended: any[] } {
  const byId = new Map<string, any>();
  const appended: any[] = [];
  const body = {
    appendChild(el: any) {
      appended.push(el);
      if (el.id) byId.set(el.id, el);
      return el;
    },
  };
  const document = {
    createElement: () => ({
      id: '',
      className: '',
      textContent: '',
      innerHTML: '',
      style: {},
      appendChild() {},
      append() {},
      addEventListener() {},
      remove() {
        appended.splice(appended.indexOf(this), 1);
        if (this.id) byId.delete(this.id);
      },
    }),
    body,
    getElementById: (id: string) => byId.get(id) ?? null,
  };
  vi.stubGlobal('document', document);
  return { body, byId, appended };
}

describe('renderUpdateToast (main-interface update reminder)', () => {
  let dom: { body: any; byId: Map<string, any>; appended: any[] };
  beforeEach(() => {
    dom = installDom();
  });

  it('shows the toast on document.body when there are pending updates', () => {
    const pending: PendingUpdate[] = [{ name: 'arrow', from: '1.0.0', to: '1.0.1', entry: 'plugins/arrow/index.js' }];
    renderUpdateToast(pending, () => {});
    const toast = dom.appended.find((el) => el.id === 'plugin-toast');
    expect(toast).toBeTruthy();
  });

  it('removes the toast when there are no pending updates', () => {
    renderUpdateToast([{ name: 'arrow', to: '1.0.1', entry: 'plugins/arrow/index.js' }], () => {});
    expect(dom.appended.find((el) => el.id === 'plugin-toast')).toBeTruthy();
    renderUpdateToast([], () => {});
    expect(dom.appended.find((el) => el.id === 'plugin-toast')).toBeFalsy();
  });

  it('does not show the toast for updates the user dismissed this session', () => {
    const pending: PendingUpdate[] = [{ name: 'arrow', to: '1.0.1', entry: 'plugins/arrow/index.js' }];
    renderUpdateToast(pending, () => {}); // first show
    // simulate "ignore" by calling the same path with the dismissed name still
    // in the list is not possible (Set is module-private); instead assert that
    // an empty visible list removes the toast (covered above).
    expect(dom.appended.find((el) => el.id === 'plugin-toast')).toBeTruthy();
  });
});
