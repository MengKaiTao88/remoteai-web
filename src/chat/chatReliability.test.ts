import { expect, it, vi } from 'vitest';
import { updateThread } from '../../../../shared/remote-chat/client/events';
import { ImageCache } from '../../../../shared/remote-chat/client/imageCache';
import { itemImageSources } from '../../../../shared/chat/imageSources';
import { deriveDshRows } from './dshViewModel';
import { activityCategory, processActivityStatus, processEntries } from './officialActivity';
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

it('keeps command and projected tool failures distinct from cancelled or stale activities', () => {
  expect(processActivityStatus({ id: 'failure', type: 'commandExecution', status: 'completed', exitCode: 1 }, true)).toBe('failed');
  expect(processActivityStatus({ id: 'projected', type: 'dynamicToolCall', success: false }, false)).toBe('failed');
  expect(processActivityStatus({ id: 'stop', type: 'mcpToolCall', status: 'cancelled' }, false)).toBe('interrupted');
  expect(processActivityStatus({ id: 'cached', type: 'commandExecution', status: 'inProgress' }, false)).toBeUndefined();
});

it('keeps official commentary and mixed activity in order across saved reasoning summaries', () => {
  const items = [
    { id: 'note', type: 'agentMessage', phase: 'commentary' as const, text: 'Checking the workspace.' },
    { id: 'shell', type: 'commandExecution', command: 'pwd' },
    { id: 'scratch', type: 'reasoning', summary: ['Intermediate summary'] },
    { id: 'chat-list', type: 'dynamicToolCall', tool: 'codex_app · list_threads' },
    { id: 'edit', type: 'dynamicToolCall', tool: '文件变更' },
    { id: 'agent', type: 'subAgentActivity', kind: 'started' },
    { id: 'answer', type: 'agentMessage', phase: 'final_answer' as const, text: 'Complete.' },
  ];
  const thread = { id: 'chat', cwd: '/', preview: '', updatedAt: 0,
    turns: [{ id: 'turn', status: 'completed', durationMs: 12000, items }] };
  const rows = deriveDshRows({ thread, approvals: [], queue: [] }).rows;
  expect(rows.map(row => row.kind)).toEqual(['process', 'assistant']);
  expect(rows[0]).toMatchObject({ timed: true });
  const entries = processEntries(rows[0].items!);
  expect(entries.map(entry => entry.id)).toEqual(['note', 'shell', 'agent']);
  expect(entries[1].kind === 'group' && entries[1].items.map(activityCategory))
    .toEqual(['command', 'chats', 'files']);
  expect(processEntries(items).some(entry => entry.id === 'scratch')).toBe(false);
});

it('uses structured exploration types and breaks groups at standalone activity boundaries', () => {
  const items = [
    { id: 'list', type: 'commandExecution', commandActions: [{ type: 'list_files' }] },
    { id: 'search', type: 'commandExecution', commandActions: [{ type: 'search' }] },
    { id: 'mixed-command', type: 'commandExecution', commandActions: [{ type: 'read' }, { type: 'unknown' }] },
    { id: 'worker', type: 'subAgentActivity', kind: 'started' },
    { id: 'integration', type: 'mcpToolCall', server: 'example' },
    { id: 'compaction', type: 'contextCompaction' },
    { id: 'future', type: 'unrecognizedEvent' },
  ];
  expect(items.map(item => activityCategory(item))).toEqual(['list', 'search', 'command', 'agent', 'integration', 'context', 'other']);
  const entries = processEntries(items);
  expect(entries.map(({ id, kind }) => [id, kind])).toEqual([
    ['list', 'group'], ['worker', 'standalone'], ['integration', 'group'], ['compaction', 'standalone'], ['future', 'standalone'],
  ]);
  expect(entries[0].kind === 'group' && entries[0].items.map(item => item.id))
    .toEqual(['list', 'search', 'mixed-command']);
});

it('keeps sleep events out of the visible process timeline like Codex Desktop', () => {
  const items = [
    { id: 'before', type: 'commandExecution', command: 'before' },
    { id: 'sleep', type: 'sleep', durationMs: 60000 },
    { id: 'legacy-sleep', type: 'dynamicToolCall', tool: 'sleep' },
    { id: 'after', type: 'commandExecution', command: 'after' },
  ];
  const entries = processEntries(items);
  expect(entries).toHaveLength(1);
  expect(entries[0].kind === 'group' && entries[0].items.map(item => item.id))
    .toEqual(['before', 'after']);
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
