import { afterEach, expect, test, vi } from 'vitest';
import type { ChatConnection } from '../../../../shared/remote-chat/client/connection';
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
