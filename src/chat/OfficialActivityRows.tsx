import { memo, useId, useState } from 'react';
import { AlertCircle, ChevronDown, ClipboardList, Columns2, FilePenLine, FileText, FolderOpen,
  Hourglass, Image, ListTree, ScanSearch, Search, SquareTerminal, Users, Waypoints, Wrench, type LucideIcon } from 'lucide-react';
import { displayText, t, useLanguage } from '../../../../shared/localization/browserClient';
import { commandPreview } from '../../../../shared/chat/commandPreview';
import { messageLabel } from '../../../../shared/chat/messageDetails';
import { activityFileNames } from '../../../../shared/conversation/activitySummary';
import { collaborationSummary } from '../../../../shared/conversation/collaborationActivity';
import type { Item } from '../../../../shared/conversation/types';
import { ChatToolContent } from '../../../../shared/remote-chat/views/ChatToolContent';
import { DshHistoryViewport } from './DshHistoryViewport';
import { activityCategory, canInspectActivity, processActivityStatus, type ActivityCategory } from './officialActivity';

const ICONS = {
  read: FileText, list: FolderOpen, search: ScanSearch, command: SquareTerminal, web: Search,
  integration: Waypoints, tool: Wrench, files: FilePenLine, agent: Users, plan: ClipboardList,
  image: Image, review: ListTree, context: Columns2, wait: Hourglass, error: AlertCircle, other: Wrench,
} satisfies Record<ActivityCategory, LucideIcon>;

function categoryLabel(category: ActivityCategory, item: Item, running = false): string {
  switch (category) {
    case 'read': return t('client.chat.readFile');
    case 'list': return t('client.chat.browseFiles');
    case 'search': return t('client.chat.searchCode');
    case 'command': return t('client.chat.runCommand');
    case 'web': return t('client.shared.searchTheWeb');
    case 'integration': return item.server || t('client.shared.useTool');
    case 'tool': return item.name || item.tool || displayText(messageLabel(item));
    case 'files': return running ? t('client.chat.editing') : t('client.shared.fileChanges');
    case 'error': return t('client.shared.error');
    default: return displayText(messageLabel(item));
  }
}

function summary(item: Item, category: ActivityCategory, nested: boolean, status?: string) {
  const label = categoryLabel(category, item, status === 'inProgress');
  if (category === 'agent') return collaborationSummary(item, displayText);
  if (category === 'command') {
    const text = commandPreview(item.commandPreview ?? item.command ?? '');
    return text ? (nested ? text : [t(status === 'inProgress' ? 'client.mobile.running' : 'client.mobile.ran'), text].join(' ')) : label;
  }
  const action = item.commandActions?.[0];
  const detail = category === 'files' ? activityFileNames(item)
    : category === 'web' ? item.action?.query || item.action?.queries?.[0] || item.action?.url || item.query
    : category === 'integration' ? item.tool : action?.name || action?.query || action?.path
      || item.tool || item.name || item.path || item.savedPath || item.query || item.failure?.message;
  if (!detail || detail === label) return label;
  if (nested && category === 'integration') return detail;
  return t('client.interface.message.7c639b', { value1: label, value2: detail });
}

const statusText = (status?: string) => status === 'failed' ? t('client.taskReview.failed')
  : status === 'interrupted' ? t('client.chat.stopped')
  : status === 'declined' ? t('client.chat.declined') : undefined;

export const OfficialActivity = memo(function OfficialActivity({ item, live, nested = false }: {
  item: Item; live: boolean; nested?: boolean;
}) {
  useLanguage();
  const id = useId();
  const [open, setOpen] = useState(false);
  const category = activityCategory(item);
  const status = processActivityStatus(item, live);
  const label = summary(item, category, nested, status);
  const outcome = statusText(status);
  const Icon = ICONS[category];
  const expandable = canInspectActivity(item);
  const text = outcome ? t('client.interface.message.7c639b', { value1: outcome, value2: label }) : label;
  const line = <><Icon size={15} aria-hidden="true" /><span title={text}>{text}</span>
    {expandable && <ChevronDown className="official-activity-chevron" size={12} aria-hidden="true" />}</>;
  return <div className="official-activity" data-process-item={item.id} data-activity-category={category} data-status={status}>
    {expandable ? <button type="button" className="official-activity-line" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(!open)}>{line}</button> : <span className="official-activity-line">{line}</span>}
    {expandable && <div className="official-activity-detail" id={id} hidden={!open}>
      {open && <ChatToolContent item={item} />}
    </div>}
  </div>;
});

export function OfficialActivityGroup({ items, live }: { items: Item[]; live: boolean }) {
  useLanguage();
  const id = useId();
  const [open, setOpen] = useState(false);
  if (items.length === 1) return <OfficialActivity item={items[0]} live={live} />;
  const labels = new Set<string>();
  let running: Item | undefined;
  let outcome: string | undefined;
  for (const item of items) {
    const status = processActivityStatus(item, live);
    if (status === 'inProgress') running = item;
    outcome ??= statusText(status);
    labels.add(categoryLabel(activityCategory(item), item, status === 'inProgress'));
  }
  const label = running ? summary(running, activityCategory(running), false, 'inProgress') : [...labels].join(' · ');
  const Icon = ICONS[activityCategory(running ?? items[0])];
  return <div className="official-activity-group" data-activity-category={activityCategory(items[0])}
    data-status={running ? 'inProgress' : undefined}>
    <button type="button" className="official-activity-line" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(!open)}>
      <Icon size={15} aria-hidden="true" /><span title={label}>{label}</span>
      {outcome && !open && <small>{outcome}</small>}
      <ChevronDown className="official-activity-chevron" size={12} aria-hidden="true" />
    </button>
    <div className="official-activity-children" id={id} hidden={!open}>
      {open && items.map((item, index) => <DshHistoryViewport key={item.id}
        enabled={items.length > 32} estimatedHeight={31} initiallyVisible={index < 12}>
        {() => <OfficialActivity item={item} live={live} nested />}
      </DshHistoryViewport>)}
    </div>
  </div>;
}
