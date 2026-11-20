import { memo, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

function LoadedProcess({ items, turnId, live }: { items: Item[]; turnId: string; live: boolean }) {
  const previousGroups = useRef(new Map<string, string>());
  const entries = useMemo(() => {
    const used = new Set<string>();
    return processEntries(items).map(entry => {
      if (entry.kind !== 'group') return { entry, key: entry.id };
      const retained = entry.items.map(item => previousGroups.current.get(item.id))
        .find(key => key && !used.has(key));
      const key = retained ?? entry.id;
      used.add(key);
      return { entry, key };
    });
  }, [items]);
  useLayoutEffect(() => {
    previousGroups.current = new Map(entries.flatMap(({ entry, key }) =>
      entry.kind === 'group' ? entry.items.map(item => [item.id, key] as const) : []));
  }, [entries]);
  const positionPrefix = `${turnId}:activity:`;
  const standalone = (item: Item): ReactNode => {
    const position = positionPrefix + item.id;
    if (item.type === 'agentMessage') return <div className="remodex-commentary" data-history-position={position}>
      <ChatMessage item={item} process desktop onOpen={() => undefined} />
    </div>;
    return <OfficialActivity item={item} live={live} position={position} />;
  };
  return <div className="remodex-process-records">{entries.map(({ entry, key }, index) => {
    const render = () => entry.kind === 'group'
      ? <OfficialActivityGroup items={entry.items} live={live} positionPrefix={positionPrefix} groupKey={key} />
      : <div className="official-process-standalone">{standalone(entry.item)}</div>;
    return <DshHistoryViewport key={key} enabled={entries.length > 32}
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
  const live = row.liveProcess === true;
  const open = choice ?? ['inProgress', 'interrupted', 'failed'].includes(turn.status);
  const label = t(live ? 'client.chat.inProgress' : 'client.chat.activity');
  const timing = live ? <LiveProcessTiming turn={turn} active={active} fallback={label} />
    : row.timed && turn.status !== 'inProgress' ? <ChatTurnTiming turn={turn} fallback={label} /> : label;
  return <section className="dsh-process remodex-process" data-turn-status={turn.status}>
    <button type="button" className="dsh-process-trigger" aria-expanded={open} aria-controls={id}
      data-history-position={row.key}
      onClick={() => setChoice(!open)}>
      <span>{timing}</span>
      <ChevronDown size={14} />
    </button>
    <div id={id} hidden={!open}>{open && <DeferredProcessDetails items={items}>
      {details => <LoadedProcess items={details} turnId={turn.id} live={live} />}
    </DeferredProcessDetails>}</div>
  </section>;
});
