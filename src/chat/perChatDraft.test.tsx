// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDraftCacheScope } from '../../../../shared/remote-chat/client/useDraftCacheScope';
import { useChatDraft } from '../../../../shared/remote-chat/client/useChatDraft';
import { useComposerAttachments } from '../../../../shared/remote-chat/views/useComposerAttachments';
import { ChatQuotesProvider, useChatQuotes } from '../../../../shared/remote-chat/views/ChatQuotes';

let root: Root;
let host: HTMLDivElement;
let draft: ReturnType<typeof useChatDraft>;
let attachments: ReturnType<typeof useComposerAttachments>;
let quotes: ReturnType<typeof useChatQuotes>;
const send = vi.fn().mockResolvedValue(true);
function Contents({ scope, sending }: { scope: string | null; sending: boolean }) {
  draft = useChatDraft({ threadId: scope, sending, disabled: false,
    selection: { model: 'fixture', effort: 'medium', access: 'workspace-write' }, send });
  attachments = useComposerAttachments({ threadId: scope, sending });
  quotes = useChatQuotes();
  return null;
}
const render = (scope: string | null, sending = false) => act(async () => root.render(
  <ChatQuotesProvider scope={scope} sending={sending} enabled><Contents scope={scope} sending={sending} /></ChatQuotesProvider>));
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
  await render('a'); expect(draft.text).toBe('');
});


it('clears acknowledged outgoing attachments and quotes without touching the destination chat', async () => {
  let finish!: (value: boolean) => void;
  send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render('a');
  await act(async () => {
    draft.setText('Send A');
    attachments.add({ kind: 'file', name: 'shared.txt', path: '/shared.txt' });
    quotes!.add({ messageId: 'origin', text: 'Shared quote', role: 'assistant' });
    await draft.addImages(async () => [{ id: 'sent-image', url: 'data:image/png;base64,aW1hZ2U=' }]);
  });
  const outgoingFiles = attachments;
  const outgoingQuotes = quotes!;
  let sent!: Promise<boolean>;
  await act(async () => { sent = draft.submit().then(ok => {
    if (ok) { outgoingFiles.clearSubmitted(outgoingFiles.items); outgoingQuotes.clear(outgoingQuotes.quotes); }
    return ok;
  }); });
  await render('b');
  await act(async () => {
    draft.setText('Keep B');
    attachments.restore(outgoingFiles.items);
    quotes!.add(outgoingQuotes.quotes[0]);
  });
  await act(async () => { finish(true); expect(await sent).toBe(true); });
  expect(draft.text).toBe('Keep B');
  expect(attachments.items).toHaveLength(1); expect(quotes!.quotes).toHaveLength(1);
  await render('a');
  expect(draft.text).toBe(''); expect(draft.images).toEqual([]);
  expect(attachments.items).toEqual([]); expect(quotes!.quotes).toEqual([]);
});

it('retains an unconfirmed source draft after navigation and never clears a newer edit', async () => {
  let finish!: (value: boolean) => void;
  send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render('a'); await act(async () => { draft.setText('Unconfirmed A'); });
  let sent!: Promise<boolean>;
  await act(async () => { sent = draft.submit(); });
  await render('b'); await act(async () => { finish(false); await sent; });
  await render('a'); expect(draft.text).toBe('Unconfirmed A');
  send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { sent = draft.submit(); });
  await render('b'); await render('a');
  await act(async () => { draft.setText('New A edit'); finish(true); await sent; });
  expect(draft.text).toBe('New A edit');
});

it('transfers an initial send owner to the created thread before switching away', async () => {
  let finish!: (value: boolean) => void;
  send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(null); await act(async () => {
    draft.setText('First send');
    attachments.add({ kind: 'file', name: 'first.txt', path: '/first.txt' });
    quotes!.add({ messageId: 'first-quote', text: 'First quote', role: 'assistant' });
  });
  const originalFiles = attachments;
  const originalQuotes = quotes!;
  let sent!: Promise<boolean>;
  await act(async () => { sent = draft.submit(); });
  sent = sent.then(ok => {
    if (ok) { originalFiles.clearSubmitted(originalFiles.items); originalQuotes.clear(originalQuotes.quotes); }
    return ok;
  });
  await render('created', true); expect(draft.text).toBe('First send');
  await render('b'); await act(async () => { draft.setText('Keep B'); finish(true); await sent; });
  expect(draft.text).toBe('Keep B');
  await render('created'); expect(draft.text).toBe('');
  expect(attachments.items).toEqual([]); expect(quotes!.quotes).toEqual([]);
});


function CreatedIdentity({ threadId, draftScope }: { threadId: string | null; draftScope: string }) {
  const scope = useDraftCacheScope({ threadId, draftScope });
  return <ChatQuotesProvider scope={scope} sending={false} enabled><Contents scope={scope} sending={false} /></ChatQuotesProvider>;
}
it('restores post-creation drafts through the real thread identity while leaving send scopes unchanged', async () => {
  const identity = (threadId: string | null, draftScope: string) => act(async () => root.render(
    <CreatedIdentity threadId={threadId} draftScope={draftScope} />));
  await identity(null, 'draft:1');
  await identity('created-thread', 'draft:1');
  await act(async () => {
    draft.setText('Unsent after creation');
    attachments.add({ kind: 'file', name: 'created.txt', path: '/created.txt' });
    quotes!.add({ messageId: 'created-answer', text: 'Created quote', role: 'assistant' });
  });
  await identity('other-thread', 'other-thread');
  await act(async () => { draft.setText('Other draft'); });
  await identity('created-thread', 'created-thread');
  expect(draft.text).toBe('Unsent after creation');
  expect(attachments.items[0].name).toBe('created.txt'); expect(quotes!.quotes).toHaveLength(1);
  await identity('other-thread', 'other-thread'); expect(draft.text).toBe('Other draft');
});
