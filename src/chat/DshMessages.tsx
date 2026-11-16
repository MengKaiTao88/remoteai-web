import { memo, useCallback, useState } from 'react';
import { ArrowDown, ChevronRight, Terminal } from 'lucide-react';
import { t, useLanguage } from '../../../../shared/localization/browserClient';
import { ChatMessage } from '../../../../shared/remote-chat/views/ChatMessage';
import { EditableChatMessage } from '../../../../shared/remote-chat/views/EditableChatMessage';
import { ChatProcessItems } from '../../../../shared/remote-chat/views/ChatProcessItems';
import { ChatTurnSummary, type TurnPanel } from '../../../../shared/remote-chat/views/ChatTurnSummary';
import { ChatTurnDetails } from '../../../../shared/remote-chat/views/ChatTurnDetails';
import { ChatToolDetails } from '../../../../shared/remote-chat/views/ChatToolDetails';
import { ChatTurnTiming } from '../../../../shared/remote-chat/views/ChatTurnTiming';
import { ChatApproval } from '../../../../shared/remote-chat/views/ChatApproval';
import { ConversationImageGallery } from '../../../../shared/chat/ImageGallery';
import { ChatSelectionQuote } from '../../../../shared/remote-chat/views/ChatSelectionQuote';
import { ViewportContent } from '../../../../shared/chat/ViewportContent';
import { useHistoryScroll } from '../../../../shared/remote-chat/views/useHistoryScroll';
import { useMobileHistoryAnchor } from '../../../../shared/remote-chat/views/useMobileHistoryAnchor';
import type { ChatController, ChatState, Item, Turn } from '../../../../shared/remote-chat/views/types';
import type { DshChatViewModel, DshRow } from './dshViewModel';
import '../../../../shared/remote-chat/views/messages.css';
import '../../../../shared/remote-chat/views/desktopMessages.css';

interface Props { state: ChatState; controller: ChatController; view: DshChatViewModel; active: boolean }
const Process = memo(function Process({ row }: { row: DshRow }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const items = row.items ?? (row.item ? [row.item] : []);
  const count = items.reduce((total, item) => total + (item.activityCount ?? 1), 0);
  return <section className="dsh-process">
    <button type="button" className="dsh-process-trigger" aria-expanded={open}
      onClick={() => setOpen(value => !value)}>
      <ChevronRight size={15} className={open ? 'is-open' : ''} />
      <span>{t('client.chat.viewActivityActions', { value1: count })}</span>
    </button>
    {open && row.turn && <ChatProcessItems items={items} turn={row.turn} />}
  </section>;
});

interface RowProps {
  row: DshRow; state: ChatState; controller: ChatController; active: boolean;
  openItem: (item: Item) => void; openTurn: (turn: Turn, panel: TurnPanel) => void;
}
const Row = memo(function Row({ row, state, controller, active, openItem, openTurn }: RowProps) {
  const inspect = useCallback(() => { if (row.item) openItem(row.item); }, [row.item, openItem]);
  if (row.kind === 'approval' && row.event) return <ChatApproval event={row.event} ready={state.ready}
    respond={reply => controller.respond(reply)} />;
  if (row.kind === 'duration' && row.turn) return <p className="chat-turn-duration">
    <ChatTurnTiming turn={row.turn} /></p>;
  if (row.kind === 'summary' && row.turn) return <ChatTurnSummary turn={row.turn}
    onOpen={panel => openTurn(row.turn!, panel)} />;
  if (row.kind === 'process' || row.kind === 'tool-group') return <Process row={row} />;
  if (!row.item) return null;
  if (row.kind === 'user' && row.turn) return <EditableChatMessage item={row.item} turn={row.turn}
    state={state} controller={controller} active={active} />;
  return <ChatMessage item={row.item} desktop running={row.turn?.status === 'inProgress'}
    onOpen={inspect} />;
}, (before, after) => before.row === after.row && before.controller === after.controller
  && before.openItem === after.openItem && before.openTurn === after.openTurn
  && (after.row.kind === 'user' ? before.state === after.state && before.active === after.active
    : after.row.kind !== 'approval' || before.state.ready === after.state.ready));

export function DshMessages({ state, controller, view, active }: Props) {
  useLanguage();
  const [tail, setTail] = useState({ threadId: state.selected?.id, space: 0 });
  const tailSpace = tail.threadId === state.selected?.id ? tail.space : 0;
  const scroll = useHistoryScroll({ thread: state.selected, loading: state.historyLoading,
    loadingMore: state.historyLoadingMore, hasMore: state.historyHasMore, historyLoad: state.historyLoad,
    loadOlder: (): Promise<void> => {
      const viewport = scroll.list.current;
      const content = scroll.content.current;
      if (viewport && content) {
        // Prepending to a short page must retain its blank tail so scrollTop is not clamped.
        const blank = viewport.getBoundingClientRect().bottom
          - parseFloat(getComputedStyle(viewport).paddingBottom) - content.getBoundingClientRect().bottom;
        if (blank > 1) setTail({ threadId: state.selected?.id, space: tailSpace + blank });
      }
      return controller.loadOlder();
    } }, true);
  useMobileHistoryAnchor({ enabled: true, viewport: scroll.list, content: scroll.body,
    readingAnchor: scroll.readingAnchor, following: scroll.following });
  const [detail, setDetail] = useState<{ itemId?: string; turnId?: string; panel?: TurnPanel; threadId?: string }>();
  const openItem = useCallback((item: Item) => setDetail({ itemId: item.id,
    threadId: state.selected?.id }), [state.selected?.id]);
  const openTurn = useCallback((turn: Turn, panel: TurnPanel) =>
    setDetail({ turnId: turn.id, panel, threadId: state.selected?.id }), [state.selected?.id]);
  const rows = view.rows.filter(row => row.kind !== 'pending');
  const currentDetail = detail?.threadId === state.selected?.id ? detail : undefined;
  const detailItem = state.selected?.turns?.flatMap(turn => turn.items).find(item => item.id === currentDetail?.itemId);
  const detailTurn = state.selected?.turns?.find(turn => turn.id === currentDetail?.turnId);
  return <ConversationImageGallery turns={state.selected?.turns ?? []}>
    <div className="chat-message-region dsh-message-region">
      <ChatSelectionQuote root={scroll.content} selected={state.selected?.id ?? null} enabled />
      <div className="chat-scroll chat-messages" aria-label={t('client.chat.chatHistory')}
        ref={scroll.list} onScroll={scroll.onScroll} onWheel={scroll.onWheel}
        onTouchStart={scroll.onTouchStart} onTouchMove={scroll.onTouchMove}
        onTouchEnd={scroll.onTouchEnd} onTouchCancel={scroll.onTouchCancel}>
        <div ref={scroll.body}><div className="chat-message-content" ref={scroll.content}
          style={tailSpace ? { paddingBottom: 16 + tailSpace } : undefined}>
          {(state.historyHasMore || state.historyLoadingMore) && <div className="chat-history-more">
            <button type="button" className="chat-text-action" disabled={state.historyLoadingMore} onClick={scroll.more}>
              {t(state.historyLoadingMore ? 'client.mobile.loading' : 'client.chat.loadEarlierMessages')}</button>
          </div>}
          {state.historyLoading && !rows.length && <p role="status">{t('client.chat.loadingChatHistory')}</p>}
          {rows.map(row => <div key={row.key} data-message-id={row.item?.id ?? row.key}
            data-dsh-row={row.kind} className={'dsh-row dsh-row-' + row.kind}
            onClickCapture={scroll.pauseFollowing}>
            <ViewportContent enabled={row.kind === 'user' || row.kind === 'assistant'}>
              {() => <Row state={state} controller={controller} active={active} row={row}
                openItem={openItem} openTurn={openTurn} />}
            </ViewportContent>
          </div>)}
          {!rows.length && !state.historyLoading && <div className="dsh-empty">
            <Terminal size={32} /><h2>{t('client.chat.whatShallWeWorkOn')}</h2>
            <p>{t('client.chat.askAQuestionOrChooseAProjectToGetStarted')}</p>
          </div>}
        </div></div>
      </div>
      {scroll.showBottom && <button type="button" className="chat-scroll-bottom" onClick={scroll.toBottom}
        aria-label={t('client.chat.scrollToBottom')}><ArrowDown size={18} /></button>}
    </div>
    {detailItem && <ChatToolDetails item={detailItem} onClose={() => setDetail(undefined)} />}
    {detailTurn && currentDetail?.panel && <ChatTurnDetails turn={detailTurn}
      panel={currentDetail.panel} onClose={() => setDetail(undefined)} />}
  </ConversationImageGallery>;
}
