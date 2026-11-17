import { memo, useMemo } from 'react';
import { t, useLanguage } from '../../../../shared/localization/browserClient';
import { ChatMarkdown } from '../../../../shared/remote-chat/views/ChatMarkdown';
import { ChatCopyButton } from '../../../../shared/remote-chat/views/ChatCopyButton';
import { ChatQuoteButton } from '../../../../shared/remote-chat/views/ChatQuotes';
import { questionMessageText } from '../../../../shared/remote-chat/client/asyncQuestions';
import type { Item } from '../../../../shared/conversation/types';
import { markdownBlocks } from './remodexMarkdown';

/** Keep memoized Markdown blocks mounted as only the streaming tail changes. */
export const RemodexAssistant = memo(function RemodexAssistant({ item, running }: { item: Item; running: boolean }) {
  useLanguage();
  const text = questionMessageText(item);
  const blocks = useMemo(() => markdownBlocks(text), [text]);
  return <article className="chat-assistant-message remodex-assistant" data-quote-source={item.id}>
    {blocks.map((block, index) => <ChatMarkdown key={index} text={block} desktop />)}
    {!!text.trim() && !running && <div className="chat-message-actions" data-quote-exclude>
      <ChatCopyButton text={text} label={t('client.chat.copyReply')} iconOnly />
      <ChatQuoteButton messageId={item.id} text={text} role="assistant" />
    </div>}
  </article>;
});
