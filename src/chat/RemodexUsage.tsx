import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { t } from '../../../../shared/localization/browserClient';
import { contextUsage } from '../../../../shared/conversation/contextUsage';
import { contextUsageLabel } from '../../../../shared/remote-chat/views/formatters';
import { ChatUsage } from '../../../../shared/remote-chat/views/ChatUsage';
import type { ComposerProps } from '../../../../shared/remote-chat/views/composerProps';
import { RemodexDialog } from './RemodexDialog';
import { FocusPreservingButton } from '../../../../shared/chat/FocusPreservingButton';
import { ChatContextSettings } from '../../../../shared/remote-chat/views/ChatContextSettings';
import { ChatContextProgress } from '../../../../shared/remote-chat/views/ChatContextProgress';
import type { ConversationMetrics } from '../../../../shared/remote-chat/conversationMetrics';
import { isCockpitMetrics } from './cockpitTelemetry';

export function RemodexUsage({ props, settings, metrics }: {
  props: ComposerProps; settings: () => void; metrics: ConversationMetrics | null;
}) {
  const [open, setOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const usage = contextUsage(props.tokenUsage);
  const percent = usage?.percent;
  const estimated = usage && props.tokenUsage?.contextTokens === null;
  const label = contextUsageLabel(props.tokenUsage);
  useEffect(() => { setOpen(false); setContextOpen(false); }, [props.threadId]);
  useEffect(() => { if (!props.active) { setOpen(false); setContextOpen(false); } }, [props.active]);
  return <>
    <FocusPreservingButton ref={trigger} type="button" className="remodex-context-ring" aria-haspopup="dialog" aria-expanded={open}
      aria-label={t('client.chat.conversationContext')} title={estimated ? label + ' ' + t('client.chat.estimated') : label}
      onClick={() => setOpen(true)}>
      <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" opacity=".2" />
        {percent != null && <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2"
          pathLength="100" strokeDasharray={percent + ' 100'} strokeLinecap="round" transform="rotate(-90 10 10)" />}
      </svg>
    </FocusPreservingButton>
    {open && <RemodexDialog label={t('client.chat.conversationContext')} close={() => setOpen(false)} anchor={trigger.current}
      className="remodex-usage-popover">
      <h2>{t('client.chat.conversationContext')}{estimated && <small> {t('client.chat.estimated')}</small>}</h2>
      {isCockpitMetrics(metrics) ? <div className="chat-usage-card">
        <ChatContextProgress usage={props.tokenUsage} disabled={!props.ready} />
      </div> : <ChatUsage read={props.readUsage} active={props.active} ready={props.ready} tokenUsage={props.tokenUsage}
        card readConversationMetrics={props.readConversationMetrics} threadId={props.threadId}
        onContextSettings={props.threadId ? () => { setOpen(false); setContextOpen(true); } : undefined} />}
      <button type="button" className="remodex-settings-link" onClick={() => { setOpen(false); settings(); }}>
        <SlidersHorizontal size={17} />{t('client.chat.chatSettings.1e06eb')}</button>
    </RemodexDialog>}
    {contextOpen && props.threadId && <ChatContextSettings threadId={props.threadId} api={props.contextSettings}
      onClose={() => setContextOpen(false)} />}
  </>;
}
