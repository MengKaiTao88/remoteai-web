// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';
import { initialChatState } from '../../../../shared/remote-chat/client/types';
import { useVisibleChatState } from './useVisibleChatState';

test('hidden streaming stays connected without rendering; reopening immediately reads the latest snapshot', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let snapshot = initialChatState();
  const listeners = new Set<() => void>();
  const source = { snapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
  const host = document.createElement('div');
  const root = createRoot(host);
  let renders = 0;
  function View({ visible }: { visible: boolean }) {
    const state = useVisibleChatState(source, visible);
    renders++;
    return <span>{state.error}</span>;
  }
  try {
    await act(async () => root.render(<View visible />));
    expect(listeners.size).toBe(1);
    await act(async () => root.render(<View visible={false} />));
    expect(listeners.size).toBe(0);
    const before = renders;
    await act(async () => {
      for (let index = 0; index < 1000; index++) {
        snapshot = { ...snapshot, error: `update ${index}` };
        listeners.forEach(listener => listener());
      }
    });
    expect(renders).toBe(before);
    await act(async () => root.render(<View visible />));
    expect(host.textContent).toBe('update 999');
    expect(listeners.size).toBe(1);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
