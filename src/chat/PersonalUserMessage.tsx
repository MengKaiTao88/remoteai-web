import { useEffect, useRef, useState } from 'react';
import { useThreadLongPress } from '../../../../shared/chat/useThreadLongPress';
import { ChatMessage } from '../../../../shared/remote-chat/views/ChatMessage';
import { EditableChatMessage } from '../../../../shared/remote-chat/views/EditableChatMessage';
import { t } from '../../../../shared/localization/browserClient';
import type { ChatController, ChatState, Item, Turn } from '../../../../shared/remote-chat/views/types';

export function PersonalUserMessage({ item, turn, state, controller, active }: {
  item: Item; turn?: Turn; state?: ChatState; controller: ChatController; active: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, [open]);
  const press = useThreadLongPress(() => setOpen(true));
  return <div ref={host} className="assistant-user-actions" data-actions-open={open || undefined}
    tabIndex={0} role="group" aria-label={t('client.shared.message')} {...press}
    onKeyDown={event => { press.onKeyDown(event); if (event.key === 'Escape') setOpen(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    {state && turn ? <EditableChatMessage item={item} turn={turn} state={state} controller={controller} active={active} />
      : <ChatMessage item={item} desktop onOpen={() => undefined} />}
  </div>;
}
