import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { t, useLanguage } from '../../../../shared/localization/browserClient';
import { ChatMessage } from '../../../../shared/remote-chat/views/ChatMessage';
import { ChatMarkdown } from '../../../../shared/remote-chat/views/ChatMarkdown';
import { ChatTurnTiming } from '../../../../shared/remote-chat/views/ChatTurnTiming';
import { DeferredProcessDetails } from '../../../../shared/chat/DeferredProcessDetails';
import { DeferredDetails } from '../../../../shared/chat/DeferredDetails';
import type { Item, Turn } from '../../../../shared/conversation/types';
import type { DshRow } from './dshViewModel';
import { itemReasoningSections, processCounts, reasoningText } from './remodexPresentation';

export const RemodexReasoning = memo(function RemodexReasoning({ item }: { item: Item }) {
  const text = reasoningText(item);
  const sections = useMemo(() => itemReasoningSections(item), [item]);
  if (!sections.length) return <div className="remodex-reasoning"><ChatMarkdown text={text} process desktop /></div>;
  return <div className="remodex-reasoning">{sections.map(section => section.detail
    ? <DeferredDetails key={section.id} summary={<summary><span>{section.title}</span><ChevronRight size={13} /></summary>}>
      {() => <div className="remodex-reasoning-detail"><ChatMarkdown text={section.detail} process desktop /></div>}
    </DeferredDetails> : <p key={section.id}>{section.title}</p>)}</div>;
});

function LoadedProcess({ items, turn, resolved }: {
  items: Item[]; turn: Turn; resolved: (items: Item[]) => void;
}) {
  useEffect(() => { resolved(items); }, [items, resolved]);
  // The disclosure already groups this process. Render chronological records directly, not another group.
  return <div className="remodex-process-records">{items.map(item => item.type === 'reasoning'
    ? <RemodexReasoning key={item.id} item={item} />
    : <ChatMessage key={item.id} item={item} process desktop
      running={turn.status === 'inProgress' && item.status === 'inProgress'} onOpen={() => undefined} />)}</div>;
}

function processLabel(items: Item[]) {
  const counts = processCounts(items);
  const labels = [
    counts.commands ? t('client.chat.activityGroupCommands', { value1: counts.commands }) : '',
    counts.tools ? t('client.chat.activityGroupOperations', { value1: counts.tools }) : '',
  ].filter(Boolean);
  return labels.join(' · ') || t('client.chat.viewActivityActions', {
    value1: items.reduce((sum, item) => sum + (item.activityCount ?? 1), 0),
  });
}

export const RemodexProcess = memo(function RemodexProcess({ row }: { row: DshRow }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<{ source: Item[]; details: Item[] }>();
  const id = useId();
  const items = useMemo(() => row.items ?? (row.item ? [row.item] : []), [row.items, row.item]);
  const resolved = useCallback((details: Item[]) => setLoaded(previous =>
    previous?.source === items && previous.details === details ? previous : { source: items, details }), [items]);
  const current = loaded?.source === items ? loaded.details : items;
  const counts = processCounts(current);
  const label = processLabel(current);
  if (!row.turn) return null;
  return <section className="dsh-process remodex-process"
    data-status={counts.failed ? 'failed' : counts.stopped ? 'interrupted' : undefined}>
    <button type="button" className="dsh-process-trigger" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(value => !value)}>
      <span>{row.timed ? <ChatTurnTiming turn={row.turn} fallback={label} /> : label}</span>
      <ChevronRight size={14} className={open ? 'is-open' : ''} />
    </button>
    {!!(counts.failed || counts.stopped) && <p className="remodex-process-outcomes">
      {!!counts.failed && <span>{t('client.taskReview.failed')} · {counts.failed}</span>}
      {!!counts.stopped && <span>{t('client.chat.stopped')} · {counts.stopped}</span>}
    </p>}
    {open && <div id={id}><DeferredProcessDetails items={items}>
      {details => <LoadedProcess items={details} turn={row.turn!} resolved={resolved} />}
    </DeferredProcessDetails></div>}
  </section>;
});
