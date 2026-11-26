import { formatConversationTps, type ConversationMetrics } from '../../../../shared/remote-chat/conversationMetrics';
import { restoreProcessing, type ProcessingState } from '../../../../shared/conversation/processing';
import type { Turn } from '../../../../shared/conversation/types';

interface CockpitMetrics extends ConversationMetrics {
  source?: 'cockpit';
  tokensPerSecond?: number | null;
  cacheHitRate?: number | null;
}

export function outputSpeed(metrics: CockpitMetrics | null) {
  if (metrics?.source !== 'cockpit') return formatConversationTps(metrics);
  const speed = metrics.tokensPerSecond;
  return typeof speed === 'number' && Number.isFinite(speed) && speed > 0 && metrics.outputRequestCount > 0
    ? speed.toFixed(1) : '—';
}

export function cacheHitRate(metrics: CockpitMetrics | null, locale: string) {
  const rate = metrics?.cacheHitRate;
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 1
    ? new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(rate) : '—';
}

type HandoffTurn = Turn & {
  processingActivity?: { itemId: string | null; kind: string | null; startedAtMs: number };
};

export function observedProcessing(turn: HandoffTurn | undefined, fallback: ProcessingState | undefined) {
  const activity = turn?.processingActivity;
  if (!turn || !activity || !Number.isSafeInteger(activity.startedAtMs) || activity.startedAtMs <= 0
    || fallback?.phase === 'input' || fallback?.phase === 'approval') return fallback;
  const { kind, itemId, startedAtMs } = activity;
  const items = typeof kind === 'string' && typeof itemId === 'string'
    ? [{ id: itemId, type: kind === 'assistantMessage' ? 'agentMessage' : kind, status: 'inProgress' }] : [];
  return { ...restoreProcessing({ ...turn, items }), startedAtMs };
}
