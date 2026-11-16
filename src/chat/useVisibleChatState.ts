import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { ChatState } from '../../../../shared/remote-chat/views/types';

interface Source { snapshot: () => ChatState; subscribe: (listener: () => void) => () => void }
const noSubscription = () => () => {};

/** Keep transport and pending operations alive without rendering a hidden conversation. */
export function useVisibleChatState(source: Source, visible: boolean): ChatState {
  const retained = useRef({ source, snapshot: source.snapshot() });
  const snapshot = useCallback(() => {
    if (visible || retained.current.source !== source) retained.current = { source, snapshot: source.snapshot() };
    return retained.current.snapshot;
  }, [source, visible]);
  return useSyncExternalStore(visible ? source.subscribe : noSubscription, snapshot);
}
