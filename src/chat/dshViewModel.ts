import type { GuiEvent, Item, Thread, Turn } from '../../../../shared/conversation/types';
import type { QueueMessage } from '../../../../shared/remote-chat/queue';
import { conversationEntries } from '../../../../shared/chat/turnPresentation';
import { currentRunningTurn } from '../../../../shared/chat/runningTurn';
import type { TurnRequestError } from '../../../../shared/conversation/turnRequestErrors';

export type DshRowKind = 'user' | 'assistant' | 'tool' | 'process' | 'approval'
  | 'question' | 'commentary' | 'change' | 'artifact' | 'pending' | 'summary' | 'duration' | 'error';
export interface DshRow {
  key: string; kind: DshRowKind; turn?: Turn; item?: Item; items?: Item[];
  event?: GuiEvent; pending?: QueueMessage; requestError?: TurnRequestError;
  timed?: boolean;
  liveProcess?: boolean;
}
export interface DshChatViewModel { rows: DshRow[]; approvals: GuiEvent[]; running: boolean }
const turnCache = new WeakMap<Turn, Map<boolean, DshRow[]>>();
const offlineCache = new WeakMap<Turn, Turn>();

function itemKind(item: Item): DshRowKind {
  if (item.type === 'userMessage') return 'user';
  if (item.type === 'agentMessage') {
    if (item.questions?.length) return 'question';
    return item.phase === 'commentary' ? 'commentary' : 'assistant';
  }
  if (item.failure || item.type === 'error' || item.status === 'failed'
    || item.type === 'commandExecution' && item.exitCode != null && item.exitCode !== 0) return 'error';
  if (item.type === 'fileChange') return 'change';
  if (item.type === 'imageGeneration') return 'artifact';
  return item.processRef ? 'process' : 'tool';
}

function turnRows(turn: Turn, previous?: Turn): DshRow[] {
  const continuation = previous?.status === 'interrupted' || previous?.status === 'failed';
  const cached = turnCache.get(turn)?.get(continuation);
  if (cached) return cached;
  const entries = conversationEntries(previous ? [previous, turn] : [turn], new Map([[turn.id, false]]))
    .filter(entry => entry.turn === turn);
  const rows: DshRow[] = [];
  for (const entry of entries) {
    if (entry.kind === 'work') {
      let pending: Item[] = [];
      let timed = entry.timed || !rows.some(row => row.kind === 'process' || row.kind === 'duration');
      const flush = () => {
        if (!pending.length) return;
        rows.push({ key: entry.id, kind: 'process', turn, items: pending, timed });
        timed = false;
        pending = [];
      };
      for (const item of entry.items) {
        if (item.type === 'reasoning') continue;
        const kind = itemKind(item);
        // A command failure is a status of that operation, so it stays with its neighboring tools.
        if (kind === 'question' || item.type === 'error') {
          flush();
          rows.push({ key: turn.id + ':message:' + item.id, kind, turn, item });
        } else pending.push(item);
      }
      if (timed && !pending.length && entry.timed) {
        rows.push({ key: `${turn.id}:duration`, kind: 'duration', turn });
      }
      flush();
    } else if (entry.kind === 'summary' || entry.kind === 'duration') {
      rows.push({ key: entry.id, kind: entry.kind, turn });
    } else if (entry.kind === 'error') {
      rows.push({ key: entry.id, kind: 'error', turn, requestError: entry.error });
    } else {
      rows.push({ key: entry.id, kind: itemKind(entry.item), turn, item: entry.item });
    }
  }
  // An earlier page can prepend the user message introducing the existing process.
  // Identify segments relative to their following steering boundary, not the loaded prefix.
  let boundary = 'tail';
  let segment = 0;
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index];
    if (row.kind === 'process') row.key = `${turn.id}:process:${boundary}:${segment++}`;
    if (row.kind === 'user') { boundary = row.key; segment = 0; }
  }
  const cache = turnCache.get(turn) ?? new Map<boolean, DshRow[]>();
  cache.set(continuation, rows);
  turnCache.set(turn, cache);
  return rows;
}

export function deriveDshRows(input: {
  thread: Thread | null; approvals: GuiEvent[]; queue: QueueMessage[]; offline?: boolean;
}): DshChatViewModel {
  const { thread, approvals, queue } = input;
  const current = approvals.filter(event => thread && event.params.threadId === thread.id);
  const turns = (thread?.turns ?? []).map(turn => {
    if (!input.offline || turn.status !== 'inProgress') return turn;
    let cached = offlineCache.get(turn);
    if (!cached) { cached = { ...turn, status: 'cached' }; offlineCache.set(turn, cached); }
    return cached;
  });
  const rows = turns.flatMap((turn, index) => turnRows(turn, turns[index - 1]));
  const running = currentRunningTurn(turns);
  for (let index = rows.length - 1; running && index >= 0; index--) {
    const row = rows[index];
    if (row.turn !== running) break;
    if (row.kind === 'process') {
      rows[index] = { ...row, liveProcess: true };
      break;
    }
  }
  return { rows: [
    ...rows,
    ...current.map(event => ({
      key: 'approval:' + thread!.id + ':' + String(event.id), kind: 'approval' as const, event,
    })),
    ...queue.map(pending => ({ key: 'pending:' + pending.id, kind: 'pending' as const, pending })),
  ], approvals: current, running: Boolean(running) };
}
