import { expect, it } from 'vitest';
import { mergeHistory } from '../../../../shared/remote-chat/client/history';
import type { Thread, Turn } from '../../../../shared/conversation/types';
import { observedProcessing } from './cockpitTelemetry';

it('uses the newer PC waiting clock after the browser merges a running turn', () => {
  const startedAtMs = 100_000;
  const turn = { id: 'turn', status: 'inProgress', startedAt: 100, items: [],
    processingActivity: { itemId: null, kind: null, startedAtMs } };
  const current: Thread = { id: 'thread', cwd: '', preview: '', updatedAt: 1, turns: [turn] };
  const endedAtMs = 159_550;
  const clock = { itemId: null, kind: null, startedAtMs: endedAtMs };
  const after = { ...current, processingActivity: { turnId: turn.id, ...clock }, turns: [{
    ...turn, processingActivity: clock, items: [{ id: 'command', type: 'commandExecution', status: 'completed' }],
  }] };
  const merged = mergeHistory(after, current, current);
  expect(merged.turns?.[0]).toHaveProperty('processingActivity.startedAtMs', startedAtMs);
  expect(observedProcessing(merged, merged.turns?.[0], undefined)).toMatchObject({
    phase: 'request', turnId: turn.id, startedAtMs: endedAtMs,
  });
});

it('ignores PC timing from a different turn and retains approval priority', () => {
  const turn: Turn = { id: 'current', status: 'inProgress', items: [] };
  const thread = { id: 'thread', cwd: '', preview: '', updatedAt: 1,
    processingActivity: { turnId: 'other', itemId: 'command', kind: 'commandExecution', startedAtMs: 100_000 } };
  expect(observedProcessing(thread, turn, undefined)).toBeUndefined();
  const approval = { turnId: turn.id, id: 'approve', phase: 'approval' as const, startedAtMs: 101_000,
    activities: [], completedIds: [] };
  expect(observedProcessing({ ...thread, processingActivity: { ...thread.processingActivity, turnId: turn.id } },
    turn, approval)).toBe(approval);
});
