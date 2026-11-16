import type { GuiEvent, Item, Thread, Turn } from '../../../../shared/conversation/types';
import type { QueueMessage } from '../../../../shared/remote-chat/queue';
import { conversationEntries } from '../../../../shared/chat/turnPresentation';

export type DshRowKind = 'user' | 'assistant' | 'tool' | 'tool-group' | 'process' | 'approval'
  | 'question' | 'change' | 'artifact' | 'pending' | 'summary' | 'duration' | 'error';
export interface DshRow {
  key: string; kind: DshRowKind; turn?: Turn; item?: Item; items?: Item[];
  event?: GuiEvent; pending?: QueueMessage;
}
export interface DshChatViewModel { rows: DshRow[]; approvals: GuiEvent[]; running: boolean }
const turnCache = new WeakMap<Turn, Map<boolean, DshRow[]>>();
const offlineCache = new WeakMap<Turn, Turn>();

function itemKind(item: Item): DshRowKind {
  if (item.type === 'userMessage') return 'user';
  if (item.type === 'agentMessage') return item.questions?.length ? 'question' : 'assistant';
  if (item.failure || item.type === 'error' || item.status === 'failed'
    || item.type === 'commandExecution' && item.exitCode != null && item.exitCode !== 0) return 'error';
  if (item.type === 'fileChange') return 'change';
  if (item.type === 'imageGeneration') return 'artifact';
  return item.processRef ? 'process' : 'tool';
}

function groupTools(rows: DshRow[]): DshRow[] {
  const grouped: DshRow[] = [];
  for (let index = 0; index < rows.length;) {
    let end = index;
    while (end < rows.length && rows[end].kind === 'tool') end++;
    if (end - index >= 3) grouped.push({
      key: 'tools:' + rows[index].key, kind: 'tool-group', turn: rows[index].turn,
      items: rows.slice(index, end).map(row => row.item!),
    });
    else grouped.push(...rows.slice(index, Math.max(index + 1, end)));
    index = Math.max(index + 1, end);
  }
  return grouped;
}

function turnRows(turn: Turn, previous?: Turn): DshRow[] {
  const continuation = previous?.status === 'interrupted' || previous?.status === 'failed';
  const cached = turnCache.get(turn)?.get(continuation);
  if (cached) return cached;
  const entries = conversationEntries(previous ? [previous, turn] : [turn]).filter(entry => entry.turn === turn);
  const rows: DshRow[] = [];
  for (const entry of entries) {
    if (entry.kind === 'work') {
      if (!entry.inline) {
        let pending: Item[] = [];
        const flush = () => {
          if (pending.length) rows.push({ key: entry.id + ':' + pending[0].id,
            kind: 'process', turn, items: pending });
          pending = [];
        };
        for (const item of entry.items) {
          if (itemKind(item) === 'error') {
            flush(); rows.push({ key: turn.id + ':message:' + item.id, kind: 'error', turn, item });
          } else pending.push(item);
        }
        flush();
      }
    } else if (entry.kind === 'summary' || entry.kind === 'duration') {
      rows.push({ key: entry.id, kind: entry.kind, turn });
    } else rows.push({ key: entry.id, kind: itemKind(entry.item), turn, item: entry.item });
  }
  const grouped = groupTools(rows);
  const cache = turnCache.get(turn) ?? new Map<boolean, DshRow[]>();
  cache.set(continuation, grouped);
  turnCache.set(turn, cache);
  return grouped;
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
  return { rows: [
    ...turns.flatMap((turn, index) => turnRows(turn, turns[index - 1])),
    ...current.map(event => ({
      key: 'approval:' + thread!.id + ':' + String(event.id), kind: 'approval' as const, event,
    })),
    ...queue.map(pending => ({ key: 'pending:' + pending.id, kind: 'pending' as const, pending })),
  ], approvals: current, running: Boolean(turns.some(turn => turn.status === 'inProgress')) };
}
