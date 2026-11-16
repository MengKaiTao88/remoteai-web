// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';
import { DshHistoryStatus } from './DshHistoryStatus';
import { initialChatState } from '../../../../shared/remote-chat/client/types';
import type { ChatController } from '../../../../shared/remote-chat/views/types';

test('an earlier-history failure survives successful tail polling and retries the older page', async () => {
  const controller = { loadOlder: vi.fn(async () => {}), select: vi.fn() } as unknown as ChatController;
  const selected = { id: 'old', preview: '', cwd: '', updatedAt: 1, turns: [] };
  const state = { ...initialChatState(), ready: true, selected, historyLoading: true, historyLoadingMore: true };
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = (next: typeof state) => act(async () => root.render(<DshHistoryStatus state={next} controller={controller} />));
  try {
    await render(state);
    await render({ ...state, historyLoading: false, historyLoadingMore: false, error: 'History unavailable' });
    expect(host.querySelector('[role=alert]')?.textContent).toContain('History unavailable');
    await render({ ...state, historyLoadingMore: false, error: '' });
    await render({ ...state, historyLoading: false, historyLoadingMore: false, error: '' });
    expect(host.querySelector('[role=alert]')?.textContent).toContain('History unavailable');
    await act(async () => host.querySelector('button')!.click());
    expect(controller.loadOlder).toHaveBeenCalledOnce();
    await render({ ...state, selected: { ...selected, id: 'different' }, historyLoading: false });
    expect(host.querySelector('[role=alert]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
