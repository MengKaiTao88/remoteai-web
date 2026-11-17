import { expect, it, vi } from 'vitest';
import { updateThread } from '../../../../shared/remote-chat/client/events';
import { ImageCache } from '../../../../shared/remote-chat/client/imageCache';
import { itemImageSources } from '../../../../shared/chat/imageSources';
import { activityStatus } from '../../../../shared/conversation/itemStatus';
import { deriveDshRows } from './dshViewModel';
import { itemReasoningSections, processCounts } from './remodexPresentation';
import type { Thread } from '../../../../shared/conversation/types';

it('keeps reasoning text deltas separate from summary deltas and honors both indices', () => {
  const initial: Thread = { id: 'chat', cwd: '/', preview: '', updatedAt: 0, turns: [
    { id: 'turn', status: 'inProgress', items: [{ id: 'r', type: 'reasoning', summary: ['Overview'],
      content: ['First detail', 'Second detail'] }] },
  ] };
  const detail = updateThread(initial, { method: 'item/reasoning/textDelta', params: {
    threadId: 'chat', turnId: 'turn', itemId: 'r', delta: ' expanded', contentIndex: 1,
  } });
  const result = updateThread(detail, { method: 'item/reasoning/summaryTextDelta', params: {
    threadId: 'chat', turnId: 'turn', itemId: 'r', delta: 'Next summary', summaryIndex: 1,
  } }).turns![0].items[0];
  expect(result.summary).toEqual(['Overview', 'Next summary']);
  expect(result.content).toEqual(['First detail', 'Second detail expanded']);
  expect(initial.turns![0].items[0].content).toEqual(['First detail', 'Second detail']);
  expect(itemReasoningSections(result).at(-1)?.detail).toContain('Second detail expanded');
});

it('recognizes supported sent and assistant image blocks without treating arbitrary content as images', () => {
  const image = 'data:image/png;base64,aW1hZ2U=';
  for (const type of ['userMessage', 'agentMessage']) {
    expect(itemImageSources({ id: 'message', type, content: [
      { type: 'localImage', path: '/project/figure.png' }, { type: 'image', url: image },
      { type: 'input_image', image_url: { url: 'https://example.test/image.png' } },
      { type: 'inputImage', imageUrl: '/project/second.png' },
      { type: 'text', path: '/private/secret.png' }, { type: 'image', url: 'javascript:alert(1)' },
    ] })).toEqual(['/project/figure.png', image, 'https://example.test/image.png', '/project/second.png']);
  }
});

it('explicit retry bypasses a decoded-bad image cache while retaining thread isolation and single-flight', async () => {
  const request = vi.fn().mockResolvedValueOnce({ url: 'data:image/png;base64,YmFk' })
    .mockResolvedValue({ url: 'data:image/png;base64,Z29vZA==' });
  const cache = new ImageCache(request);
  const first = await cache.load('a', '/image.png');
  expect(await cache.load('a', '/image.png')).toBe(first);
  expect(request).toHaveBeenCalledTimes(1);
  expect(await cache.load('a', '/image.png', false, true)).not.toBe(first);
  await cache.load('b', '/image.png');
  expect(request).toHaveBeenCalledTimes(3);
  const simultaneous = Promise.all([cache.load('c', '/image.png'), cache.load('c', '/image.png')]);
  await simultaneous;
  expect(request).toHaveBeenCalledTimes(4);
});

it('normalizes failed and cancelled executions, preserving summary outcomes without fake tool counts', () => {
  expect(activityStatus({ id: 'failure', type: 'commandExecution', status: 'completed', exitCode: 1 })).toBe('failed');
  expect(activityStatus({ id: 'stop', type: 'mcpToolCall', status: 'cancelled' })).toBe('interrupted');
  expect(processCounts([{ id: 'summary', type: 'processSummary', activityCount: 12,
    processActivityMetrics: { commands: 3, tools: 2, failed: 1, stopped: 1 } }]))
    .toEqual({ commands: 3, tools: 2, failed: 1, stopped: 1 });
  expect(processCounts([{ id: 'legacy', type: 'processSummary', activityCount: 12 }]).tools).toBe(0);
});

it('retains process identity and timing when earlier work is prepended to the same turn', () => {
  const turn = { id: 'turn', status: 'completed', durationMs: 7000, items: [
    { id: 'work', type: 'commandExecution', command: 'pwd', status: 'completed' },
    { id: 'answer', type: 'agentMessage', phase: 'final_answer' as const, text: 'Done' },
  ] };
  const thread: Thread = { id: 'chat', cwd: '/', preview: '', updatedAt: 0, turns: [turn] };
  const before = deriveDshRows({ thread, approvals: [], queue: [] }).rows.find(row => row.kind === 'process')!;
  const after = deriveDshRows({ thread: { ...thread, turns: [{ ...turn, items: [
    { id: 'earlier', type: 'reasoning', summary: ['Earlier context'] }, ...turn.items,
  ] }] }, approvals: [], queue: [] }).rows.find(row => row.kind === 'process')!;
  expect(after.key).toBe(before.key);
  expect(after.timed).toBe(true);
});
