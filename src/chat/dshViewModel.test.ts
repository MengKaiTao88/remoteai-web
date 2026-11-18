import { expect, it } from 'vitest';
import { deriveDshRows } from './dshViewModel';
import type { Thread, Turn } from '../../../../shared/conversation/types';

const turn: Turn = { id: 'turn', status: 'completed', items: [
  { id: 'u', type: 'userMessage', text: 'prompt' },
  { id: 'a', type: 'agentMessage', text: 'working', phase: 'commentary' },
  { id: 'c', type: 'commandExecution', command: 'pwd', status: 'completed' },
  { id: 'f', type: 'agentMessage', text: 'answer', phase: 'final_answer' },
] };
const thread: Thread = { id: 'thread', cwd: '/', preview: '', updatedAt: 0, turns: [turn] };
const derive = (value: Thread) => deriveDshRows({ thread: value, approvals: [], queue: [] });

it('folds only completed process and keeps final answer outside the disclosure', () => {
  const rows = derive(thread).rows;
  expect(rows.map(row => row.kind)).toEqual(['user', 'process', 'assistant']);
  expect(rows[1].items?.map(item => item.id)).toEqual(['a', 'c']);
  expect(rows[2].item?.text).toBe('answer');
});
it('keeps a stopped process readable and preserves unchanged row identities during another turn', () => {
  const stopped = derive({ ...thread, turns: [{ ...turn, status: 'interrupted' }] }).rows;
  expect(stopped.find(row => row.kind === 'process')?.items?.map(item => item.id)).toEqual(['a', 'c']);
  const before = derive(thread);
  const next = derive({ ...thread, turns: [turn, { id: 'live', status: 'inProgress',
    items: [{ id: 'new', type: 'agentMessage', text: 'stream' }] }] });
  expect(next.rows[0]).toBe(before.rows[0]);
  expect(next.rows[1]).toBe(before.rows[1]);
});
it('separates request identity from repeated text and retains all current approval types', () => {
  const result = deriveDshRows({ thread, queue: [
    { id: 'one', text: 'repeat', imageCount: 0, attachmentCount: 0, busy: false },
    { id: 'two', text: 'repeat', imageCount: 0, attachmentCount: 0, busy: true, official: true },
  ], approvals: [
    { id: 1, method: 'item/fileChange/requestApproval', params: { threadId: 'thread' } },
    { id: 2, method: 'item/tool/requestUserInput', params: { threadId: 'other' } },
  ] });
  expect(result.approvals).toHaveLength(1);
  expect(result.rows.filter(row => row.kind === 'pending').map(row => row.key)).toEqual(['pending:one', 'pending:two']);
});
it('groups three live tools without swallowing a user interruption or final reply', () => {
  const tools = ['1', '2', '3'].map(id => ({ id, type: 'commandExecution', command: 'pwd' }));
  const result = derive({ ...thread, turns: [{ id: 'live', status: 'inProgress',
    items: [...tools, { id: 'steer', type: 'userMessage', text: 'wait' },
      { id: 'reply', type: 'agentMessage', text: 'yes', phase: 'final_answer' }] }] });
  expect(result.rows.map(row => row.kind)).toEqual(['process', 'user', 'assistant']);
});

it('keeps failed commands in chronological order even when their enclosing turn completed', () => {
  const result = derive({ ...thread, turns: [{ ...turn, items: [
    ...turn.items.slice(0, 3), { id: 'failed-command', type: 'commandExecution', command: 'false',
      status: 'completed', exitCode: 1 }, turn.items[3],
  ] }] });
  expect(result.rows.find(row => row.kind === 'process')?.items?.map(item => item.id))
    .toEqual(['a', 'c', 'failed-command']);
  expect(result.rows.at(-1)?.item?.id).toBe('f');
});

it('keeps the process key when a streamed answer arrives and the turn completes', () => {
  const live = { ...turn, status: 'inProgress', items: turn.items.slice(0, -1) };
  expect(derive({ ...thread, turns: [live] }).rows.find(row => row.kind === 'process')?.key)
    .toBe(derive(thread).rows.find(row => row.kind === 'process')?.key);
});

it('does not show cached offline work as a running turn and restores live state on reconnect', () => {
  const live: Thread = { ...thread, turns: [{ ...turn, status: 'inProgress' }] };
  const offline = deriveDshRows({ thread: live, approvals: [], queue: [], offline: true });
  expect(offline.running).toBe(false);
  expect(offline.rows[0].turn?.status).toBe('cached');
  expect(derive(live).running).toBe(true);
  expect(live.turns![0].status).toBe('inProgress');
});
