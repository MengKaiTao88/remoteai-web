// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useChatDraft } from '../../../../shared/remote-chat/client/useChatDraft';
import { useComposerAttachments } from '../../../../shared/remote-chat/views/useComposerAttachments';
import { ChatQuotesProvider, useChatQuotes } from '../../../../shared/remote-chat/views/ChatQuotes';

let root: Root;
let host: HTMLDivElement;
let draft: ReturnType<typeof useChatDraft>;
let attachments: ReturnType<typeof useComposerAttachments>;
let quotes: ReturnType<typeof useChatQuotes>;
const send = vi.fn().mockResolvedValue(true);
function Contents({ scope }: { scope: string | null }) {
  draft = useChatDraft({ threadId: scope, sending: false, disabled: false,
    selection: { model: 'fixture', effort: 'medium', access: 'workspace-write' }, send });
  attachments = useComposerAttachments({ threadId: scope, sending: false });
  quotes = useChatQuotes();
  return null;
}
const render = (scope: string | null) => act(async () => root.render(
  <ChatQuotesProvider scope={scope} sending={false} enabled><Contents scope={scope} /></ChatQuotesProvider>));
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('restores each chat’s text, skill mentions, images, files and quotes after A → B → A', async () => {
  await render('a');
  await act(async () => {
    draft.setText('Please ');
    attachments.add({ kind: 'file', name: 'a.txt', path: '/a.txt' });
    quotes!.add({ messageId: 'a-message', text: 'Quoted from A', role: 'assistant' });
  });
  await act(async () => {
    draft.insertSkill({ start: 7, end: 7 }, { name: 'review', path: '/skills/review', enabled: true, description: '' });
    await draft.addImages(async () => [{ id: 'a-image', url: 'data:image/png;base64,aW1hZ2U=' }]);
  });
  const originalText = draft.text;
  await render('b');
  expect(draft.text).toBe(''); expect(draft.images).toEqual([]);
  expect(attachments.items).toEqual([]); expect(quotes!.quotes).toEqual([]);
  await act(async () => { draft.setText('Draft B'); });
  await render('a');
  expect(draft.text).toBe(originalText);
  expect(draft.images.map(image => image.id)).toEqual(['a-image']);
  expect(attachments.items.map(file => file.name)).toEqual(['a.txt']);
  expect(quotes!.quotes[0].messageId).toBe('a-message');
  await act(async () => { await draft.submit(); });
  expect(send.mock.calls[0][0].skills).toEqual([{ name: 'review', path: '/skills/review' }]);
  await render('b'); expect(draft.text).toBe('Draft B');
  await render('a'); expect(draft.text).toBe(''); expect(draft.images).toEqual([]);
});

it('does not clear another chat when an earlier send completes after navigation', async () => {
  let finish!: (value: boolean) => void;
  send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render('a'); await act(async () => { draft.setText('Pending A'); });
  let sent!: Promise<boolean>;
  await act(async () => { sent = draft.submit(); });
  await render('b'); await act(async () => { draft.setText('Keep B'); finish(true); await sent; });
  expect(draft.text).toBe('Keep B');
  await render('a'); expect(draft.text).toBe('Pending A');
});
