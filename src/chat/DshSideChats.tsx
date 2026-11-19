import { Check, MessageCircle, X } from 'lucide-react';
import { displayText, t } from '../../../../shared/localization/browserClient';
import { threadPresentation } from '../../../../shared/remote-chat/sidebar';
import type { ChatState, Thread } from '../../../../shared/remote-chat/views/types';

type LinkedThread = Thread & { sideChats?: Thread[]; attachedToThreadId?: string; sideConversation?: boolean;
  sideConversationParentNavigationPath?: string };

function parentId(thread: LinkedThread) {
  if (thread.attachedToThreadId) return thread.attachedToThreadId;
  return thread.sideConversation
    ? thread.sideConversationParentNavigationPath?.match(/^\/local\/([^/?#]+)/)?.[1] : undefined;
}

export function DshSideChats({ state, close, select }: {
  state: ChatState; close: () => void; select: (thread: Thread) => void;
}) {
  const { selected, sidebar } = state;
  const threads = new Map(state.threads.map(thread => [thread.id, thread]));
  if (selected) threads.set(selected.id, { ...threads.get(selected.id), ...selected });
  const root = selected && (parentId(threads.get(selected.id)!) ?? selected.id);
  const linked = [...threads.values()].filter(thread => root && parentId(thread) === root);
  const reported = (selected as LinkedThread | null)?.sideChats;
  const entries = reported ?? linked;
  const empty = selected && !reported
    ? t(state.ready ? 'client.errors.updateRemoteAiOnYourComputerAndTryAgain' : 'client.chat.connectToYourComputerToViewChats')
    : t('client.mobileChat.noSideChats');
  const label = t('client.mobileChat.sideChats');
  return <div className="dsh-side-chats-layer">
    <div className="dsh-side-chats-backdrop" aria-hidden="true" onClick={close} />
    <section className="dsh-side-chats" role="dialog" aria-modal="true" aria-label={label} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
    }}>
      <header><h2>{label}</h2><button type="button" className="dsh-side-chats-close"
        aria-label={t('client.projectBrowser.close')} onClick={close}><X size={18} /></button></header>
      {entries.length === 0 ? <p>{empty}</p> : <ul>
        {entries.map(thread => <li key={thread.id}>
          <button type="button" aria-current={selected?.id === thread.id || undefined} onClick={() => select(thread)}>
            <MessageCircle size={18} aria-hidden="true" />
            <span>{threadPresentation(thread, sidebar, displayText).title}</span>
            {selected?.id === thread.id && <Check size={17} aria-hidden="true" />}
          </button>
        </li>)}
      </ul>}
    </section>
  </div>;
}
