import { useEffect, useRef, useState } from 'react';
import { displayError, t } from '../../../../shared/localization/browserClient';
import type { ChatController, ChatState } from '../../../../shared/remote-chat/views/types';

/** A successful live-tail poll does not mean an earlier-history request succeeded. */
export function DshHistoryStatus({ state, controller }: { state: ChatState; controller: ChatController }) {
  const [failure, setFailure] = useState<{ threadId: string; older: boolean; error: string }>();
  const pending = useRef<{ threadId: string; older: boolean }>();
  const threadId = state.selected?.id;
  useEffect(() => {
    if (state.historyLoading && threadId) {
      pending.current = { threadId, older: state.historyLoadingMore };
    } else if (pending.current && pending.current.threadId === threadId) {
      const attempt = pending.current;
      pending.current = undefined;
      if (state.error) setFailure({ ...attempt, error: state.error });
      else if (attempt.older && state.historyLoad) setFailure(undefined);
      else if (!attempt.older) setFailure(current => current?.older ? current : undefined);
    }
  }, [threadId, state.historyLoading, state.historyLoadingMore, state.historyLoad, state.error]);
  const current = failure?.threadId === threadId ? failure : undefined;
  if (!state.historyLoading && !current) return null;
  return <div className="dsh-history-status" role={current ? 'alert' : 'status'}>
    <span>{current ? displayError(current.error) : t('client.chat.loadingChatHistory')}</span>
    {current && <button type="button" className="chat-text-action" disabled={state.historyLoading || !state.ready}
      onClick={() => { if (current.older) void controller.loadOlder();
        else if (state.selected) void controller.select(state.selected); }}>
      {t(current.older ? 'client.chat.loadEarlierMessages' : 'client.chat.refreshChats')}</button>}
  </div>;
}
