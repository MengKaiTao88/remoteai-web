// Remote AI's shared hooks own the draft, queue and send behavior; this file owns DSH's input layout.
import { displayError, displayText } from '../../../../shared/localization/browserClient';
import { flushSync } from 'react-dom';
import { ComposerDictation } from '../../../../shared/chat/dictation/ComposerDictation';
import { useComposerSuggestion } from '../../../../shared/chat/useComposerSuggestion';
import { ComposerSuggestion } from '../../../../shared/remote-chat/views/ComposerSuggestion';
import { ComposerInput } from '../../../../shared/remote-chat/views/ComposerInput';
import { t, useLanguage } from '../../../../shared/localization/browserClient';
import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, ChevronRight, Gauge, ListFilter, ListOrdered, Play, Plus, Square } from 'lucide-react';
import { COMPOSER_ACTION_LABELS } from '../../../../shared/remote-chat/composerAction';
import { useDesktopLayout } from '../../../../shared/layout/useDesktopLayout';
import { DshModelPicker } from './DshModelPicker';
import { RemodexUsage } from './RemodexUsage';
import { FocusPreservingButton } from '../../../../shared/chat/FocusPreservingButton';
import { ChatSettings } from '../../../../shared/remote-chat/views/ChatSettings';
import { ModelRefreshButton } from '../../../../shared/remote-chat/views/ModelRefreshButton';
import { ComposerFooter } from '../../../../shared/remote-chat/views/ComposerFooter';
import { ComposerAccess } from '../../../../shared/remote-chat/views/ComposerDesktopControls';
import { DesktopUsageContext } from '../../../../shared/chat/DesktopUsageContext';
import { useConversationMetrics } from '../../../../shared/remote-chat/client/useConversationMetrics';
import { formatConversationTps } from '../../../../shared/remote-chat/conversationMetrics';
import { ComposerGoal } from '../../../../shared/remote-chat/views/ComposerGoal';
import { ChatAttachmentPreviews } from '../../../../shared/remote-chat/views/ChatAttachments';
import { pickChatImages } from '../../../../shared/remote-chat/views/pickChatImages';
import { ChatImageEditor } from '../../../../shared/remote-chat/views/ChatImageEditor';
import { ComposerAttachments } from '../../../../shared/remote-chat/views/ComposerAttachments';
import { ChatQueue } from '../../../../shared/remote-chat/views/ChatQueue';
import { ComposerQuotes } from '../../../../shared/remote-chat/views/ChatQuotes';
import { ComposerAddMenu, ComposerPluginMenu, ChatCommandMenu, type ComposerAddAction } from '../../../../shared/remote-chat/views/ComposerMenus';
import { ComposerProjectFiles } from '../../../../shared/remote-chat/views/ComposerProjectFiles';
import { ComposerConversationMenu } from '../../../../shared/remote-chat/views/ComposerConversationMenu';
import { ComposerFileMenu } from '../../../../shared/remote-chat/views/ComposerFileMenu';
import { ComposerSshMenu } from '../../../../shared/remote-chat/views/ComposerSshMenu';
import { useComposerState } from '../../../../shared/remote-chat/views/useComposerState';
import type { ComposerProps } from '../../../../shared/remote-chat/views/composerProps';
import '../../../../shared/remote-chat/views/composer.css';
import '../../../../shared/remote-chat/views/composerDesktop.css';
import '../../../../shared/remote-chat/views/composerReading.css';

export function DshComposerInput(props: ComposerProps & {
  loadedTurns?: readonly import('../../../../shared/conversation/types').Turn[];
  historyHasMore?: boolean;
  conversationCounts?: { turns: number; steps: number };
}) {
  useLanguage();
  const desktop = useDesktopLayout();
  const usageSnapshot = useContext(DesktopUsageContext);
  const metrics = useConversationMetrics(props.readConversationMetrics, props.threadId,
    props.active && props.ready && usageSnapshot.visible);
  const { models, selection, settingsBusy, settingsError, updateSettings, readUsage, tokenUsage, queue,
    uploadProgress, threadId, active, ready, sending, goal, goalBusy, catalog, cwd, loadFiles, loadCatalog } = props;
  const state = useComposerState(props);
  const { draft, attachments, menu, busy, action, actionDisabled, goalMode } = state;
  const [focused, setFocused] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const queuePanelId = useId();
  const [settings, setSettings] = useState(false);
  const [adding, setAdding] = useState(false);
  const [projectFiles, setProjectFiles] = useState<'files' | 'photos' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pickerThread = useRef(threadId);
  const dock = useRef<HTMLDivElement>(null);
  const suggestion = useComposerSuggestion({ source: props.suggestions, value: draft.text,
    blocked: !active || !ready || sending || props.running || props.compacting || settingsBusy || busy || state.dictationBusy
      || draft.hasContent || attachments.items.length > 0 || state.hasQuotes || state.readingClipboard
      || state.queueEditor.loading || menu.open || adding || settings || !!projectFiles || goalMode.enabled,
    fill: text => { draft.setText(text); menu.setSelection({ start: text.length, end: text.length });
      menu.input.current?.focus(); } });
  const editing = draft.images.find(image => image.id === editingId);
  const readCatalog = useCallback(() => loadCatalog(cwd), [loadCatalog, cwd]);
  useEffect(() => { if (!active || busy || !editing) setEditingId(null); }, [active, busy, editing]);
  useEffect(() => { if (!active) { setSettings(false); setAdding(false); setProjectFiles(null); } }, [active]);
  useEffect(() => { setSettings(false); setAdding(false); setProjectFiles(null); }, [threadId]);
  useEffect(() => { setProjectFiles(null); }, [cwd]);
  useEffect(() => { setFocused(false); setQueueOpen(false); }, [threadId]);
  useEffect(() => {
    if (!queue?.messages.length) setQueueOpen(false);
  }, [queue?.messages.length]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let peak = 0;
    const resize = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      if (inset > peak) peak = inset;
      if (peak > 150 && inset < peak / 2) { setFocused(false); peak = 0; }
    };
    viewport.addEventListener('resize', resize);
    return () => viewport.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (!adding && !menu.open) return;
    const close = (event: PointerEvent) => {
      if (!dock.current?.contains(event.target as Node)) { setAdding(false); menu.close(); }
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') { setAdding(false); menu.close(); }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', keydown);
    };
  }, [adding, menu.open, menu.close]);
  const chooseAdd = (choice: ComposerAddAction) => {
    setAdding(false);
    if (choice === 'plugins') { menu.openPlugins(); return; }
    if (choice === 'projectFiles' || choice === 'projectPhotos') {
      setProjectFiles(choice === 'projectPhotos' ? 'photos' : 'files'); return;
    }
    pickerThread.current = threadId;
    ({ camera: cameraInput, photos: photoInput, file: fileInput })[choice].current?.click();
  };
  const pickPhotos = (files: File[]) => {
    if (pickerThread.current === threadId) void draft.addImages(remaining => pickChatImages(files, remaining));
  };
  const ActionIcon = { send: ArrowUp, pause: Square, continue: Play }[action];
  const closeMenus = () => { menu.close(); setAdding(false); };
  const showSettings = () => { closeMenus(); setSettings(true); };
  const placeholder = t('client.workspaceActions.typeAMessageOrToChooseASkill');
  const expanded = focused || draft.hasContent || attachments.items.length > 0
    || state.hasQuotes || state.dictationBusy || !!goal || goalMode.enabled || queueOpen;
  return <div className="dsh-input-host" ref={dock} onKeyDown={event => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { setAdding(false); menu.close(); }
  }}>
    {props.projectPicker}
    {queue && queue.messages.length > 0 && <div className="dsh-input-queue remodex-queue" data-open={queueOpen || undefined}>
      <FocusPreservingButton type="button" className="remodex-queue-toggle" aria-expanded={queueOpen} aria-controls={queuePanelId}
        onClick={() => setQueueOpen(value => !value)}>
        <ListOrdered size={14} />{t('client.chat.queued')} {queue.messages.length}<ChevronRight size={12} />
      </FocusPreservingButton>
      <div id={queuePanelId} hidden={!queueOpen}>
        <ChatQueue {...queue} {...state.queueEditor} editDisabled={state.queueEditor.editDisabled || busy} />
      </div>
    </div>}
    <form className="dsh-input" data-open={expanded || undefined}
      data-tray={!!(draft.images.length || attachments.items.length || state.hasQuotes || goalMode.enabled || goal) || undefined}
      onFocusCapture={event => { if (event.target instanceof HTMLTextAreaElement) setFocused(true); }}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false); }}
      onSubmit={event => { event.preventDefault(); void state.submit(); }}>
      <input ref={photoInput} type="file" accept="image/*" multiple hidden aria-label={t("client.chat.choosePhotos")}
        onChange={event => { pickPhotos(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden aria-label={t("client.chat.takePhoto")}
        onChange={event => { pickPhotos(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <input ref={fileInput} type="file" multiple hidden aria-label={t("client.cliImport.chooseFile")} onChange={event => {
        if (pickerThread.current === threadId) void attachments.pick(Array.from(event.target.files ?? []));
        event.target.value = '';
      }} />
      {state.error && <p role="alert" className="chat-error">{displayError(state.error)}</p>}
      {settingsError && <p role="alert" className="chat-error">{displayError(settingsError)}
        <ModelRefreshButton ready={ready} refreshModels={props.refreshModels} />
        <button type="button" className="chat-button" disabled={!ready || !models.length}
          onClick={() => { void updateSettings(selection); }}>{t("client.chat.saveAgain")}</button></p>}
      {props.compacting && <p role="status" className="chat-muted">{t("client.chat.compactingContext")}</p>}
      {(draft.picking || attachments.busy || state.readingClipboard || state.drop.reading)
        && <p role="status" className="chat-muted">{t("client.chat.addingAttachments")}</p>}
      {(adding || menu.open) && <div className="chat-composer-popover" onKeyDown={event => {
        if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Escape') { setAdding(false); menu.close(); menu.input.current?.focus(); }
      }}>{adding && <ComposerAddMenu busy={busy} choose={chooseAdd} />}
        {!adding && menu.conversations && props.loadConversations && <ComposerConversationMenu
          key={threadId} input={menu.input} query={menu.query} threadId={threadId} ready={ready && !busy}
          load={props.loadConversations} close={menu.close}
          choose={reference => { if (attachments.add(reference)) menu.consumeTrigger(); }} />}
        {!adding && menu.plugins && <ComposerPluginMenu catalog={catalog} query={menu.query} load={readCatalog}
          input={menu.input} close={menu.close}
          chooseSkill={menu.choose}
          choosePlugin={plugin => { attachments.addPlugin(plugin); menu.consumeTrigger(); }} />}
        {!adding && menu.files && <ComposerFileMenu key={`${threadId}:${cwd}`} input={menu.input}
          query={menu.query} threadId={threadId} cwd={cwd} ready={ready && !busy} load={loadFiles} close={menu.close}
          choose={reference => { if (attachments.add(reference)) menu.consumeTrigger(); }} />}
        {!adding && menu.ssh && <ComposerSshMenu key={`${threadId}:${cwd}`} input={menu.input}
          query={menu.query} ready={ready && !busy} profiles={props.sshProfiles} close={menu.close}
          choose={reference => { if (attachments.add(reference)) menu.consumeTrigger(); }} />}
        {!adding && !menu.plugins && !menu.conversations && !menu.files && !menu.ssh && <ChatCommandMenu
            catalog={catalog} query={menu.query} skillsOnly={menu.skillsOnly} input={menu.input}
            compactReason={props.compactReason} choose={menu.choose} compact={() => { void menu.runCompact(); }}
            goal={() => { menu.consumeTrigger(); goalMode.enter(); }} close={menu.close} />}</div>}
      <div className="dsh-input-layout"
        ref={state.dropTarget} {...state.drop.handlers} data-file-dragging={state.drop.dragging || undefined}>
        <div className="dsh-input-tray" hidden={!(draft.images.length || attachments.items.length || state.hasQuotes || goalMode.enabled || goal)}>
          <ChatAttachmentPreviews images={draft.images} busy={busy} remove={draft.removeImage}
            upload={sending ? uploadProgress : undefined} reconnecting={!ready}
            add={() => setAdding(true)} edit={id => { menu.input.current?.blur(); setEditingId(id); }} />
          <ComposerAttachments items={attachments.items} busy={busy} active={active} ready={ready}
            uploadProgress={sending ? uploadProgress : undefined} remove={attachments.remove} />
          <ComposerQuotes disabled={busy} />
          {(goalMode.enabled || goal) && <ComposerGoal key={`goal:${threadId}:${active}`}
            goal={goalMode.enabled ? null : goal} draft={draft.text}
            disabled={sending || goalBusy || (!!goal && !ready)} remove={state.removeGoal}
            beforeOpen={() => { closeMenus(); menu.input.current?.blur(); }} />}
        </div>
        <div className="chat-composer-content">
          <ComposerSuggestion text={suggestion.text} accept={suggestion.accept} />
          <ComposerInput ref={menu.input} aria-label={t("client.chat.chatMessage")} value={draft.text} maxLength={100_000} rows={1}
            onPointerDown={() => setFocused(true)}
            contextScope={`${threadId}:${cwd}`} active={active}
            readOnly={state.queueEditor.loading}
            onBeforeInput={suggestion.dismiss} onCompositionStart={suggestion.dismiss}
            onCompositionEnd={suggestion.restore}
            onPaste={event => { suggestion.dismiss(); state.paste(event); }} onChange={event => {
              if (event.target.value) suggestion.dismiss();
              else suggestion.restore();
              draft.setText(event.target.value);
              menu.setSelection({ start: event.target.selectionStart, end: event.target.selectionEnd });
            }}
            onSelect={event => menu.setSelection({ start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd })}
            placeholder={ready ? (goalMode.enabled ? t("client.chat.describeYourGoal") : placeholder) : t("client.chat.connectToSendAMessage")}
            onKeyDown={event => {
              if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229) return;
              if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey
                && !menu.open && suggestion.accept()) { event.preventDefault(); return; }
              if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) suggestion.dismiss();
              state.pasteKeyDown(event);
              if (event.key === 'Escape') { menu.close(); setAdding(false); return; }
              if (event.key !== 'Enter' || event.shiftKey || event.altKey) return;
              if (!desktop && !(event.ctrlKey || event.metaKey)) return;
              if (desktop && action === 'pause') { event.preventDefault(); return; }
              event.preventDefault(); void state.submit();
            }} />
        </div>
        <div className="dsh-input-leading">
          <FocusPreservingButton type="button" className="dsh-input-key" aria-label={t("client.chat.addContent")} aria-expanded={adding}
            disabled={busy} onClick={() => { menu.close(); setAdding(value => !value); }}>
            <Plus size={desktop ? 18 : 24} /></FocusPreservingButton>
          <ComposerAccess selection={selection} settingsBusy={settingsBusy || !ready}
            accessUpdate={props.accessUpdate} updateSettings={updateSettings} beforeOpen={closeMenus} />
        </div>
        <div className="dsh-input-trailing">
            <RemodexUsage props={props} settings={showSettings} />
            <DshModelPicker models={models} active={active} ready={ready} refreshModels={props.refreshModels}
              scope={threadId ?? props.draftScope} selection={selection} variant="footer" modelOnly={!desktop}
              updateSettings={updateSettings} settingsBusy={settingsBusy} settingsError={settingsError} beforeOpen={closeMenus} />
            {props.dictation && <ComposerDictation key={`dictation:${threadId}:${cwd}`} client={props.dictation}
              buttonClassName="dsh-input-key dsh-input-voice"
              active={active && ready && !sending && !props.compacting && !settings && !settingsBusy && !goalBusy}
              disabled={!active || !ready || busy || settingsBusy || props.compacting || goalBusy}
              onBusyChange={state.setDictationBusy}
              onText={text => { flushSync(() => draft.appendDictation(text)); menu.input.current?.focus(); }} />}
            {(!props.dictation || expanded || action !== 'send') && <FocusPreservingButton type="button"
              className="dsh-input-key dsh-input-send" aria-label={displayText(COMPOSER_ACTION_LABELS[action])}
              onClick={() => { void state.submit(); }} aria-busy={state.pausing || sending} disabled={actionDisabled}>
              <ActionIcon size={desktop ? 18 : 22}
                fill={action === 'continue' || (desktop && action === 'pause') ? 'currentColor' : 'none'} /></FocusPreservingButton>}
        </div>
      </div>
    </form>
    {desktop && <ComposerFooter desktop={desktop} cliVersion={props.cliVersion} threadId={props.threadId}
      readServiceStatus={props.readServiceStatus} statusActive={active} statusConnected={props.serviceStatusConnected}
      usage={usageSnapshot.usage} metrics={metrics} />}
    {!desktop && threadId && <div className="dsh-mobile-chat-stats">
      <span><Gauge size={13} aria-hidden="true" />{formatConversationTps(metrics)} tok/s</span>
      {props.loadedTurns && <span><ListFilter size={13} aria-hidden="true" />{t(props.historyHasMore && !props.conversationCounts
        ? 'client.mobileChat.loadedTurnAndStepCount' : 'client.mobileChat.turnAndStepCount', {
        turns: Math.max(props.conversationCounts?.turns ?? 0, props.loadedTurns.length),
        steps: Math.max(props.conversationCounts?.steps ?? 0, props.loadedTurns.reduce((sum, turn) => sum + turn.items.length, 0)),
      })}</span>}
    </div>}
    {active && !busy && editing && <ChatImageEditor key={editing.id} image={editing}
      save={url => draft.replaceImage(editing, url)} close={() => setEditingId(null)} />}
    {projectFiles && <ComposerProjectFiles imagesOnly={projectFiles === 'photos'} threadId={threadId} cwd={cwd}
      load={loadFiles} close={() => setProjectFiles(null)} choose={file => {
        attachments.add({ kind: 'file', name: file.name, path: file.path }); setProjectFiles(null);
      }} />}
    {settings && <ChatSettings models={models} selection={selection} threadId={threadId}
      cwd={cwd} cliLocked={sending || props.running}
      connection={props.connection}
      contextSettings={props.contextSettings} readUsage={readUsage} tokenUsage={tokenUsage}
      readConversationMetrics={props.readConversationMetrics}
      saving={settingsBusy} error={settingsError} ready={ready} refreshModels={props.refreshModels}
      updateSettings={updateSettings} onClose={() => setSettings(false)} />}
  </div>;
}
