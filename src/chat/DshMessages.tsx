import { memo, useCallback, useMemo, useState } from 'react';
import { lastUserMessage } from '../../../../shared/chat/latestUserMessage';
import { ArrowDown, Terminal } from 'lucide-react';
import { t, useLanguage } from '../../../../shared/localization/browserClient';
import { ChatMessage } from '../../../../shared/remote-chat/views/ChatMessage';
import { PersonalUserMessage } from './PersonalUserMessage';
import { RemodexProcess, RemodexReasoning } from './RemodexProcess';
import { RemodexAssistant } from './RemodexAssistant';
import { ChatTurnSummary, type TurnPanel } from '../../../../shared/remote-chat/views/ChatTurnSummary';
import { ChatTurnDetails } from '../../../../shared/remote-chat/views/ChatTurnDetails';
import { ChatToolDetails } from '../../../../shared/remote-chat/views/ChatToolDetails';
import { ChatTurnTiming } from '../../../../shared/remote-chat/views/ChatTurnTiming';
import { ChatApproval } from '../../../../shared/remote-chat/views/ChatApproval';
import { ConversationImageGallery } from '../../../../shared/chat/ImageGallery';
import { ChatSelectionQuote } from '../../../../shared/remote-chat/views/ChatSelectionQuote';
import { DshHistoryActiveContext, DshHistoryViewport } from './DshHistoryViewport';
import { useHistoryScroll } from '../../../../shared/remote-chat/views/useHistoryScroll';
import { useMobileHistoryAnchor } from '../../../../shared/remote-chat/views/useMobileHistoryAnchor';
import type { ChatController, ChatState, Item, Turn } from '../../../../shared/remote-chat/views/types';
import type { DshChatViewModel, DshRow } from './dshViewModel';
import { createDshGalleryProjector } from './dshGallery';
import { DshHistoryStatus } from './DshHistoryStatus';
import '../../../../shared/remote-chat/views/messages.css';
import '../../../../shared/remote-chat/views/desktopMessages.css';

interface Props { state: ChatState; controller: ChatController; view: DshChatViewModel; active: boolean }
interface RowProps {
  row: DshRow; editState?: ChatState; ready: boolean; controller: ChatController; active: boolean;
  openItem: (item: Item) => void; openTurn: (turn: Turn, panel: TurnPanel) => void;
}
function Row({ row, editState, ready, controller, active, openItem, openTurn }: RowProps) {
  const inspect = useCallback(() => { if (row.item) openItem(row.item); }, [row.item, openItem]);
  if (row.kind === 'approval' && row.event) return <ChatApproval event={row.event} ready={ready}
    respond={reply => controller.respond(reply)} />;
  if (row.kind === 'duration' && row.turn) return <p className="chat-turn-duration">
    <ChatTurnTiming turn={row.turn} /></p>;
  if (row.kind === 'summary' && row.turn) return <ChatTurnSummary turn={row.turn}
    onOpen={panel => openTurn(row.turn!, panel)} />;
  if (row.kind === 'process') return <RemodexProcess row={row} active={active} />;
  if (!row.item) return null;
  if (row.item.type === 'reasoning' && !row.item.processRef) return <RemodexReasoning item={row.item} />;
  if (row.kind === 'commentary') return <div className="remodex-commentary">
    <ChatMessage item={row.item} process desktop onOpen={() => undefined} /></div>;
  if (row.kind === 'user') return <PersonalUserMessage item={row.item} turn={row.turn}
    state={editState} controller={controller} active={active} />;
  if (row.kind === 'assistant' && row.item.type === 'agentMessage') return <RemodexAssistant item={row.item}
    running={row.turn?.status === 'inProgress'} />;
  return <ChatMessage item={row.item} desktop running={row.turn?.status === 'inProgress'}
    onOpen={inspect} />;
}

function sameContent(before: DshRow, after: DshRow) {
  if (before === after) return true;
  if (before.key !== after.key || before.kind !== after.kind || before.timed !== after.timed) return false;
  if (before.timed && (before.turn?.durationMs !== after.turn?.durationMs
    || before.turn?.startedAt !== after.turn?.startedAt || before.turn?.completedAt !== after.turn?.completedAt)) return false;
  if (before.event || after.event) return before.event === after.event;
  if (before.turn?.id !== after.turn?.id || before.turn?.status !== after.turn?.status) return false;
  if (before.item || after.item) return before.item === after.item;
  if (before.items && after.items) return before.items.length === after.items.length
    && before.items.every((item, index) => item === after.items![index]);
  return before.turn === after.turn;
}

const INITIAL_VISIBLE_ROWS = 16;
const HistoryRow = memo(function HistoryRow(props: RowProps & { pause: () => void; initiallyVisible: boolean }) {
  const { row } = props;
  return <div data-message-id={row.item?.id ?? row.key} data-dsh-row={row.kind}
    className={'dsh-row dsh-row-' + row.kind} onClickCapture={props.pause}>
    <DshHistoryViewport enabled={row.kind !== 'approval'} initiallyVisible={props.initiallyVisible}>
      {() => <Row {...props} />}
    </DshHistoryViewport>
  </div>;
}, (before, after) => sameContent(before.row, after.row) && before.controller === after.controller
  && before.openItem === after.openItem && before.openTurn === after.openTurn && before.pause === after.pause
  && before.editState === after.editState && before.active === after.active && before.ready === after.ready);

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
  const rows = useMemo(() => view.rows.filter(row => row.kind !== 'pending'), [view.rows]);
  const latestUser = useMemo(() => lastUserMessage(state.selected
    ? { turns: state.selected.turns ?? [] } : undefined), [state.selected]);
  const pause = useCallback(() => { scroll.following.current = false; }, [scroll.following]);
  const currentDetail = detail?.threadId === state.selected?.id ? detail : undefined;
  const detailItem = currentDetail?.itemId ? state.selected?.turns?.map(turn =>
    turn.items.find(item => item.id === currentDetail.itemId)).find(Boolean) : undefined;
  const detailTurn = currentDetail?.turnId ? state.selected?.turns?.find(turn => turn.id === currentDetail.turnId) : undefined;
  const projectGallery = useMemo(createDshGalleryProjector, [state.selected?.id]);
  const galleryTurns = useMemo(() => projectGallery(state.selected?.turns ?? []), [projectGallery, state.selected?.turns]);
  return <ConversationImageGallery turns={galleryTurns}>
    <DshHistoryActiveContext.Provider value={active}>
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
          <DshHistoryStatus state={state} controller={controller} />
          {rows.map((row, index) => <HistoryRow key={row.key} ready={state.ready} controller={controller} active={active} row={row}
            initiallyVisible={index >= rows.length - INITIAL_VISIBLE_ROWS}
            editState={row.kind === 'user' && row.turn?.id === latestUser?.turnId
              && row.item?.id === latestUser?.item.id ? state : undefined}
            pause={pause} openItem={openItem} openTurn={openTurn} />)}
          {!rows.length && !state.historyLoading && <div className="dsh-empty">
            <Terminal size={32} /><h2>{t('client.chat.whatShallWeWorkOn')}</h2>
            <p>{t('client.chat.askAQuestionOrChooseAProjectToGetStarted')}</p>
          </div>}
        </div></div>
      </div>
      {scroll.showBottom && <button type="button" className="chat-scroll-bottom" onClick={scroll.toBottom}
        aria-label={t('client.chat.scrollToBottom')}><ArrowDown size={18} /></button>}
    </div>
    </DshHistoryActiveContext.Provider>
    {detailItem && <ChatToolDetails item={detailItem} onClose={() => setDetail(undefined)} />}
    {detailTurn && currentDetail?.panel && <ChatTurnDetails turn={detailTurn}
      panel={currentDetail.panel} onClose={() => setDetail(undefined)} />}
  </ConversationImageGallery>;
}
