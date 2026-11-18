import { memo, useId, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { t, useLanguage } from '../../../../shared/localization/browserClient';
import { ChatMessage } from '../../../../shared/remote-chat/views/ChatMessage';
import { ChatTurnTiming } from '../../../../shared/remote-chat/views/ChatTurnTiming';
import { useProcessingSeconds } from '../../../../shared/remote-chat/client/useProcessingSeconds';
import { formatTurnDuration } from '../../../../shared/remote-chat/views/formatters';
import { DeferredProcessDetails } from '../../../../shared/chat/DeferredProcessDetails';
import type { Item, Turn } from '../../../../shared/conversation/types';
import type { DshRow } from './dshViewModel';
import { processEntries } from './officialActivity';
import { OfficialActivity, OfficialActivityGroup } from './OfficialActivityRows';
import { DshHistoryViewport } from './DshHistoryViewport';

function LoadedProcess({ items, turn }: { items: Item[]; turn: Turn }) {
  const entries = useMemo(() => processEntries(items), [items]);
  const live = turn.status === 'inProgress';
  const standalone = (item: Item): ReactNode => {
    if (item.type === 'agentMessage') return <div className="remodex-commentary">
      <ChatMessage item={item} process desktop onOpen={() => undefined} />
    </div>;
    return <OfficialActivity item={item} live={live} />;
  };
  return <div className="remodex-process-records">{entries.map((entry, index) => {
    const render = () => entry.kind === 'group'
      ? <OfficialActivityGroup items={entry.items} live={live} />
      : <div className="official-process-standalone">{standalone(entry.item)}</div>;
    return <DshHistoryViewport key={entry.id} enabled={entries.length > 32}
      estimatedHeight={entry.kind === 'group' ? 30 : undefined}
      initiallyVisible={index >= entries.length - 12}>{render}</DshHistoryViewport>;
  })}</div>;
}

function LiveProcessTiming({ turn, active, fallback }: { turn: Turn; active: boolean; fallback: string }) {
  const { totalSeconds } = useProcessingSeconds(turn, active && turn.startedAt != null);
  return turn.startedAt == null ? fallback
    : <>{t('client.chat.workingFor')} {formatTurnDuration(totalSeconds * 1000)}</>;
}

export const RemodexProcess = memo(function RemodexProcess({ row, active }: { row: DshRow; active: boolean }) {
  useLanguage();
  const [choice, setChoice] = useState<boolean>();
  const id = useId();
  const items = useMemo(() => row.items ?? (row.item ? [row.item] : []), [row.items, row.item]);
  const turn = row.turn;
  if (!turn) return null;
  const open = choice ?? ['inProgress', 'interrupted', 'failed'].includes(turn.status);
  const label = t(turn.status === 'inProgress' ? 'client.chat.inProgress' : 'client.chat.activity');
  const timing = !row.timed ? label : turn.status === 'inProgress'
    ? <LiveProcessTiming turn={turn} active={active} fallback={label} />
    : <ChatTurnTiming turn={turn} fallback={label} />;
  return <section className="dsh-process remodex-process" data-turn-status={turn.status}>
    <button type="button" className="dsh-process-trigger" aria-expanded={open} aria-controls={id}
      onClick={() => setChoice(!open)}>
      <span>{timing}</span>
      <ChevronDown size={14} />
    </button>
    <div id={id} hidden={!open}>{open && <DeferredProcessDetails items={items}>
      {details => <LoadedProcess items={details} turn={turn} />}
    </DeferredProcessDetails>}</div>
  </section>;
});
