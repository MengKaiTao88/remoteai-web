import { Database, Gauge } from 'lucide-react';
import { getLocale, t } from '../../../../shared/localization/browserClient';
import type { ConversationMetrics } from '../../../../shared/remote-chat/conversationMetrics';
import { cacheHitRate, outputSpeed } from './cockpitTelemetry';

export function DshConversationStats({ metrics }: { metrics: ConversationMetrics | null }) {
  return <div className="dsh-mobile-chat-stats">
    <span><Gauge size={13} aria-hidden="true" />{outputSpeed(metrics)} tok/s</span>
    <span><Database size={13} aria-hidden="true" />{t('client.chat.cached')} {cacheHitRate(metrics, getLocale())}</span>
  </div>;
}
