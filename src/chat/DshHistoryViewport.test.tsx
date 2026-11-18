// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';
import type { VirtualScrollAnchor } from '../../../../shared/chat/virtualScroll';
const listener = vi.hoisted(() => ({ current: undefined as undefined
  | ((visible: boolean, anchor: VirtualScrollAnchor | null) => void) }));
vi.mock('../../../../shared/chat/viewportObserver', () => ({
  observeViewport: (_node: Element, callback: typeof listener.current) => {
    listener.current = callback;
    return () => { listener.current = undefined; };
  },
}));
import { DshHistoryActiveContext, DshHistoryViewport } from './DshHistoryViewport';

test('deferred rows do not render rich content until approached', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('IntersectionObserver', class {});
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const host = document.createElement('div');
  const root = createRoot(host);
  const child = vi.fn(() => <p>Rich message</p>);
  try {
    await act(async () => root.render(<DshHistoryViewport initiallyVisible={false}>{child}</DshHistoryViewport>));
    expect(child).not.toHaveBeenCalled();
    await act(async () => listener.current!(true, null));
    expect(host.textContent).toBe('Rich message');
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

test('hiding a page cannot overwrite a measured row height with zero', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('IntersectionObserver', class {});
  let resize = () => {};
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {} disconnect() {}
  });
  let hidden = false;
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
    ({ width: hidden ? 0 : 320, height: hidden ? 0 : 210 } as DOMRect));
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<DshHistoryViewport initiallyVisible>{() => <p>Message</p>}</DshHistoryViewport>));
    hidden = true;
    resize();
    await act(async () => listener.current!(false, null));
    expect(host.firstElementChild?.getAttribute('style')).toContain('height: 210px');
  } finally {
    await act(async () => root.unmount());
    bounds.mockRestore(); vi.unstubAllGlobals();
  }
});

test('keeps a mounted row in place while the workspace is hidden and ignores a late visibility callback', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('IntersectionObserver', class {});
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = (active: boolean) => <DshHistoryActiveContext.Provider value={active}>
    <DshHistoryViewport initiallyVisible>{() => <p>Message</p>}</DshHistoryViewport>
  </DshHistoryActiveContext.Provider>;
  try {
    await act(async () => root.render(render(true)));
    const staleCallback = listener.current!;
    const message = host.querySelector('p');
    await act(async () => root.render(render(false)));
    expect(listener.current).toBeUndefined();
    await act(async () => staleCallback(false, null));
    expect(host.querySelector('p')).toBe(message);
    await act(async () => root.render(render(true)));
    expect(listener.current).toBeDefined();
    expect(host.querySelector('p')).toBe(message);
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
