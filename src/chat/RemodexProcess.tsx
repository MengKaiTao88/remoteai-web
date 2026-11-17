import { memo, useMemo, useState } from 'react';
import { ChevronRight, Terminal } from 'lucide-react';
import { t, useLanguage } from '../../../../shared/localization/browserClient';
import { ChatMessage } from '../../../../shared/remote-chat/views/ChatMessage';
import { ChatMarkdown } from '../../../../shared/remote-chat/views/ChatMarkdown';
import { DeferredProcessDetails } from '../../../../shared/chat/DeferredProcessDetails';
import { DeferredDetails } from '../../../../shared/chat/DeferredDetails';
import { ChatActivity } from '../../../../shared/remote-chat/views/ChatActivity';
import { ChatToolDetails } from '../../../../shared/remote-chat/views/ChatToolDetails';
import { groupConsecutiveActivities, latestActivity } from '../../../../shared/conversation/activityGroups';
import type { Item, Turn } from '../../../../shared/conversation/types';
import type { DshRow } from './dshViewModel';
import { processCounts, reasoningSections, reasoningText } from './remodexPresentation';

export const RemodexReasoning = memo(function RemodexReasoning({ item }: { item: Item }) {
  const text = reasoningText(item);
  const sections = useMemo(() => reasoningSections(text), [text]);
  if (!sections.length) return <div className="remodex-reasoning"><ChatMarkdown text={text} process desktop /></div>;
  return <div className="remodex-reasoning">{sections.map(section => section.detail
    ? <DeferredDetails key={section.id} summary={<summary><ChevronRight size={11} /><span>{section.title}</span></summary>}>
      {() => <div className="remodex-reasoning-detail"><ChatMarkdown text={section.detail} process desktop /></div>}
    </DeferredDetails> : <p key={section.id}>{section.title}</p>)}</div>;
});

function LoadedProcess({ items, turn }: { items: Item[]; turn: Turn }) {
  const [selected, setSelected] = useState<string>();
  const selectedItem = items.find(item => item.id === selected);
  const message = (item: Item) => item.type === 'reasoning'
    ? <RemodexReasoning key={item.id} item={item} />
    : <ChatMessage key={item.id} item={item} process desktop
        running={turn.status === 'inProgress' && item.status !== 'completed'} onOpen={setSelected} />;
  return <>
    {groupConsecutiveActivities(items).map(group => {
      const latest = latestActivity(group.items);
      return group.activity && group.items.length > 1 && latest
        ? <ChatActivity key={group.key} item={latest} items={group.items} inline running={false}
            onOpen={() => setSelected(latest.id)} content={() => group.items.map(message)} />
        : message(group.items[0]);
    })}
    {selectedItem && <ChatToolDetails item={selectedItem} onClose={() => setSelected(undefined)} />}
  </>;
}

function ToolDisclosure({ items, turn }: { items: Item[]; turn: Turn }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const counts = processCounts(items);
  const tools = items;
  const count = counts.commands + counts.tools;
  // Deferred process references must keep using the existing authenticated details loader.
  const deferred = tools.some(item => item.processRef);
  return <section className="dsh-process remodex-process">
    {(!!count || deferred) && <>
      <button type="button" className="dsh-process-trigger" aria-expanded={open}
        onClick={() => setOpen(value => !value)}><Terminal size={16} />
        <span>{t(counts.commands && !counts.tools && !deferred ? 'client.chat.activityGroupCommands' : 'client.chat.viewActivityActions',
          { value1: count })}</span><ChevronRight size={12} className={open ? 'is-open' : ''} />
      </button>
      {!!(counts.failed || counts.stopped) && <p className="remodex-process-outcomes">
        {!!counts.failed && <span>{t('client.taskReview.failed')} · {counts.failed}</span>}
        {!!counts.stopped && <span>{t('client.chat.stopped')} · {counts.stopped}</span>}
      </p>}
      {open && <DeferredProcessDetails items={tools}>
        {loaded => <LoadedProcess items={loaded} turn={turn} />}
      </DeferredProcessDetails>}
    </>}
  </section>;
}

export const RemodexProcess = memo(function RemodexProcess({ row }: { row: DshRow }) {
  const items = row.items ?? (row.item ? [row.item] : []);
  return <div className="remodex-process-sequence">{groupConsecutiveActivities(items).map(group => {
    const item = group.items[0];
    if (item.type === 'reasoning') return <RemodexReasoning key={group.key} item={item} />;
    if (item.type === 'agentMessage') return <div className="remodex-commentary" key={group.key}>
      <ChatMessage item={item} process desktop running={row.turn?.status === 'inProgress'} onOpen={() => undefined} />
    </div>;
    return row.turn ? <ToolDisclosure key={group.key} items={group.items} turn={row.turn} /> : null;
  })}</div>;
});
