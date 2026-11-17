// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { RemodexDialog } from './RemodexDialog';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('portals into its own device workspace and releases the native modal when unmounted', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const previous = document.createElement('div'); previous.className = 'dsh-workspace'; previous.hidden = true;
  const active = document.createElement('div'); active.className = 'dsh-workspace';
  const anchor = document.createElement('button'); active.append(anchor);
  const host = document.createElement('div'); active.append(host);
  document.body.append(previous, active);
  const prototype = HTMLDialogElement.prototype;
  const saved = ['showModal', 'close'].map(name => Object.getOwnPropertyDescriptor(prototype, name));
  const show = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
  const close = vi.fn(function (this: HTMLDialogElement) { this.open = false; });
  Object.defineProperty(prototype, 'showModal', { configurable: true, value: show });
  Object.defineProperty(prototype, 'close', { configurable: true, value: close });
  const root = createRoot(host);
  try {
    act(() => root.render(<RemodexDialog label="Fixture" close={() => {}} anchor={anchor}>Contents</RemodexDialog>));
    expect(active.querySelector('dialog')?.parentElement).toBe(active);
    expect(previous.querySelector('dialog')).toBeNull();
    expect(show).toHaveBeenCalledOnce();
  } finally {
    act(() => root.unmount());
    expect(close).toHaveBeenCalledOnce();
    expect(document.querySelector('dialog')).toBeNull();
    ['showModal', 'close'].forEach((name, index) => {
      if (saved[index]) Object.defineProperty(prototype, name, saved[index]!);
      else Reflect.deleteProperty(prototype, name);
    });
  }
});
