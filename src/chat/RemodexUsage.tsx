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

export function RemodexUsage({ props, settings }: { props: ComposerProps; settings: () => void }) {
  const [open, setOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const percent = contextUsage(props.tokenUsage)?.percent;
  useEffect(() => { setOpen(false); setContextOpen(false); }, [props.threadId]);
  useEffect(() => { if (!props.active) { setOpen(false); setContextOpen(false); } }, [props.active]);
  return <>
    <FocusPreservingButton ref={trigger} type="button" className="remodex-context-ring" aria-haspopup="dialog" aria-expanded={open}
      aria-label={t('client.chat.conversationContext')} title={contextUsageLabel(props.tokenUsage)}
      onClick={() => setOpen(true)}>
      <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" opacity=".2" />
        {percent != null && <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2"
          pathLength="100" strokeDasharray={percent + ' 100'} strokeLinecap="round" transform="rotate(-90 10 10)" />}
        {percent == null && <circle cx="10" cy="10" r="1.4" fill="currentColor" />}
      </svg>
    </FocusPreservingButton>
    {open && <RemodexDialog label={t('client.chat.conversationContext')} close={() => setOpen(false)} anchor={trigger.current}
      className="remodex-usage-popover">
      <h2>{t('client.chat.conversationContext')}</h2>
      <ChatUsage read={props.readUsage} active={props.active} ready={props.ready} tokenUsage={props.tokenUsage}
        card readConversationMetrics={props.readConversationMetrics} threadId={props.threadId}
        onContextSettings={props.threadId ? () => { setOpen(false); setContextOpen(true); } : undefined} />
      <button type="button" className="remodex-settings-link" onClick={() => { setOpen(false); settings(); }}>
        <SlidersHorizontal size={17} />{t('client.chat.chatSettings.1e06eb')}</button>
    </RemodexDialog>}
    {contextOpen && props.threadId && <ChatContextSettings threadId={props.threadId} api={props.contextSettings}
      onClose={() => setContextOpen(false)} />}
  </>;
}
