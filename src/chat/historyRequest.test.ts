import { afterEach, expect, test, vi } from 'vitest';
import type { ChatConnection } from '../../../../shared/remote-chat/client/connection';
import { applyHistoryDelta, historyVersion } from '../../../../shared/remote-chat/historySync';
import type { PagedHistoryDelta } from '../../../../shared/remote-chat/historyPage';
import type { Thread } from '../../../../shared/remote-chat/client/types';
import { boundedHistoryRequest } from './historyRequest';

afterEach(() => vi.useRealTimers());

test('a stalled view acknowledgement releases the history loading chain', async () => {
  vi.useFakeTimers();
  const request = vi.fn(() => new Promise(() => {})) as unknown as ChatConnection['request'];
  const result = boundedHistoryRequest(request)('request', { operation: 'viewThread', threadId: 'old' });
  const rejected = expect(result).rejects.toThrow('client.projectBrowser.theRequestTimedOutPleaseTryAgain');
  await vi.advanceTimersByTimeAsync(10_000);
  await rejected;
});

test('a pending history read settles while late responses remain harmless', async () => {
  vi.useFakeTimers();
  let finish!: (value: unknown) => void;
  const request = vi.fn(() => new Promise(resolve => { finish = resolve; })) as unknown as ChatConnection['request'];
  const result = boundedHistoryRequest(request)('request', { operation: 'syncHistory', threadId: 'old' });
  const rejected = expect(result).rejects.toThrow('client.projectBrowser.theRequestTimedOutPleaseTryAgain');
  await vi.advanceTimersByTimeAsync(40_000);
  await rejected;
  finish({ thread: {} });
  await vi.runAllTimersAsync();
  expect(vi.getTimerCount()).toBe(0);
});

test('sending and queue operations retain their original promise and delivery rules', () => {
  const original = Promise.resolve({ confirmed: true });
  const request = vi.fn(() => original) as unknown as ChatConnection['request'];
  const wrapped = boundedHistoryRequest(request);
  for (const operation of ['send', 'queueSend', 'composerSet']) {
    expect(wrapped('request', { operation })).toBe(original);
  }
});

test('the first history request uses a bounded page and keeps its older-history cursor', async () => {
  const selected: Thread = { id: 'old', cwd: '', preview: '', updatedAt: 0 };
  const thread: Thread = { ...selected, turns: [{ id: 'turn', status: 'completed',
    items: [{ id: 'answer', type: 'agentMessage', text: 'Latest answer' }] }] };
  const page = { hasMore: true, start: { turnId: 'turn', itemId: 'answer' } };
  const request = vi.fn(async (_, body) => body.operation === 'read' ? { thread, page } : { page });
  const read = boundedHistoryRequest(request as unknown as ChatConnection['request'], true);
  const initial = { operation: 'syncHistory', threadId: 'old', deferToolDetails: true,
    known: historyVersion(selected), window: { deferProcesses: true } };
  const delta = await read<PagedHistoryDelta>('request', initial);
  expect(request).toHaveBeenCalledExactlyOnceWith('request', {
    operation: 'read', threadId: 'old', deferToolDetails: true, includeToolDetails: false,
    window: { pageSize: 16 },
  });
  expect(applyHistoryDelta(selected, delta)).toEqual(thread);
  expect(delta.page).toEqual(page);

  const older = { ...initial, known: historyVersion(thread), window: { ...initial.window, older: true, start: page.start } };
  await read('request', older);
  expect(request).toHaveBeenLastCalledWith('request', {
    ...older, window: { ...older.window, deferProcesses: false, pageSize: 16 },
  });
});

test('a host without a bounded history page can use its original history endpoint', async () => {
  const request = vi.fn().mockResolvedValueOnce({ thread: { id: 'old' } })
    .mockRejectedValueOnce(new Error('unsupported window')).mockResolvedValueOnce('original history');
  const read = boundedHistoryRequest(request as unknown as ChatConnection['request'], true);
  const initial = { operation: 'syncHistory', threadId: 'old', deferToolDetails: true, known: { fields: {}, turns: [] } };
  await expect(read('request', initial)).resolves.toBe('original history');
  expect(request).toHaveBeenLastCalledWith('request', initial);
});

test('older history pages request the same small batch and retry unchanged for older hosts', async () => {
  const original = {
    operation: 'syncHistory', threadId: 'old', deferToolDetails: true,
    known: { fields: {}, turns: [{ id: 'turn', fields: {}, items: [] }] },
    window: { older: true, start: { turnId: 'turn', itemId: 'answer' } },
  };
  const request = vi.fn()
    .mockRejectedValueOnce(new Error('unsupported page size'))
    .mockResolvedValueOnce('legacy result');
  const read = boundedHistoryRequest(request as unknown as ChatConnection['request'], true);
  await expect(read('request', original)).resolves.toBe('legacy result');
  expect(request).toHaveBeenNthCalledWith(1, 'request', {
    ...original, window: { ...original.window, deferProcesses: false, pageSize: 16 },
  });
  expect(request).toHaveBeenNthCalledWith(2, 'request', original);
});
