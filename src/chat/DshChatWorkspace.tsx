import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { ChevronLeft, Ellipsis, PanelLeft, SquarePen, X } from 'lucide-react';
import { t, displayText, displayError, useLanguage } from '../../../../shared/localization/browserClient';
import type { ChatComputer } from '../../../../shared/remote-chat/devices';
import type { ComputerListRefresh } from '../../../../shared/remote-chat/ComputerSearchBar';
import type { ChatController, ChatProject, ChatState } from '../../../../shared/remote-chat/views/types';
import { ChatThreads } from '../../../../shared/remote-chat/views/ChatThreads';
import { ChatSearch } from '../../../../shared/remote-chat/views/ChatSearch';
import { ChatDevices } from '../../../../shared/remote-chat/views/ChatDevices';
import { ChatProfileMenu } from '../../../../shared/remote-chat/views/ChatProfileMenu';
import { ChatThreadFilter } from '../../../../shared/remote-chat/views/ChatThreadFilter';
import { ChatProjectSwitch } from '../../../../shared/remote-chat/views/ChatProjectSwitch';
import { CliGuiProvider, useCliGui } from '../../../../shared/cli-gui/context';
import { CliConversationPane } from '../../../../shared/cli-gui/CliConversationPane';
import { ChatTaskStatus } from '../../../../shared/remote-chat/views/ChatTaskStatus';
import { TaskRecoveryPrompt } from '../../../../shared/conversation/recovery/TaskRecoveryPrompt';
import { visibleChatError } from '../../../../shared/remote-chat/chatError';
import { threadPresentation } from '../../../../shared/remote-chat/sidebar';
import { queueProps } from '../../../../shared/remote-chat/client/queueProps';
import { ChatTerminalLayout } from '../../../../shared/remote-chat/views/ChatTerminalLayout';
import { deriveDshRows, isOfficialThread } from './dshViewModel';
import { useDshLayout } from './useDshLayout';
import { useDshDrawerGesture } from './useDshDrawerGesture';
import { useSidebarModal } from './useSidebarModal';
import { DshChatProviders } from './DshChatProviders';
import { DshComposer } from './DshComposer';
import { DshMessages } from './DshMessages';
import { DshDetails } from './DshDetails';
import { DshMobileSidebar } from './DshMobileSidebar';
import { useDesktopLayout } from '../../../../shared/layout/useDesktopLayout';
import { useThemeMode } from '../theme/preference';
import '../../../../shared/remote-chat/views/chat.css';
import './assistantChat.css';

export interface DshChatWorkspaceProps {
  chat: { state: ChatState; controller: ChatController; foreground: boolean };
  device?: ChatComputer; devices: ChatComputer[]; active: boolean; scope: string; email: string;
  chooseDevice: (id: string) => void; deviceRefresh?: ComputerListRefresh;
  headerActions?: ReactNode; composerHeader?: ReactNode; cliVersion?: string | null;
  openAccounts?: () => void; openDiscover?: () => void; openSettings?: () => void;
  onWorkspaceChange?: (cwd: string) => void;
}

export function DshChatWorkspace(props: DshChatWorkspaceProps) {
  const dark = useThemeMode() === 'dark';
  return <ConfigProvider theme={{ token: { colorPrimary: dark ? '#ececec' : '#0d0d0d',
    colorLink: dark ? '#ececec' : '#0d0d0d', colorTextLightSolid: dark ? '#0d0d0d' : '#fff' } }}>
    <CliGuiProvider key={props.scope} transport={props.chat.controller.cliGui}
    enabled={props.active && props.chat.foreground && props.chat.state.ready}>
    <DshWorkspaceContent {...props} />
  </CliGuiProvider></ConfigProvider>;
}

function DshWorkspaceContent(props: DshChatWorkspaceProps) {
  useLanguage();
  const { chat, device, active, scope, devices, chooseDevice, deviceRefresh } = props;
  const { state, controller, foreground } = chat;
  const cli = useCliGui();
  const desktop = useDesktopLayout();
  const external = Boolean(cli && cli.state.engine !== 'codex');
  const [sidebar, setSidebar] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [details, setDetails] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pickingDevice, setPickingDevice] = useState(false);
  const { host, layout } = useDshLayout(sidebar, details);
  const preference = useThemeMode();
  const selected = state.selected;
  const cwd = external && cli ? cli.state.selected?.cwd ?? cli.state.cwd
    : selected?.cwd ?? state.draftProject?.cwd ?? '';
  const enabled = active && foreground;
  const queue = queueProps(state, controller);
  const official = isOfficialThread(selected) || Boolean(selected
    && isOfficialThread(state.threads.find(thread => thread.id === selected.id)));
  const view = useMemo(() => deriveDshRows({ thread: selected, approvals: state.approvals,
    queue: queue.messages, offline: !state.ready, official }),
    [selected, state.approvals, state.queue, state.localQueue, state.ready, official]);
  const title = selected ? threadPresentation(selected, state.sidebar, displayText).title : t('client.chat.newChat');
  const error = visibleChatError(state.error, state);
  const listOpen = layout.left === 'sidebar' || drawer;
  const overlay = listOpen && layout.left !== 'sidebar';
  useSidebarModal(host, overlay);
  useDshDrawerGesture({ host, enabled: active && layout.left !== 'sidebar' && !details && !searching
    && !pickingDevice, open: drawer, onChange: setDrawer });
  const closeList = () => { setDrawer(false); if (layout.left === 'sidebar') setSidebar(false); };
  const chooseComputer = () => setPickingDevice(true);
  const newChat = (project?: ChatProject) => {
    if (state.sending || cli?.state.busy) return;
    cli?.controller.newConversation();
    if (project?.cwd) cli?.controller.patch({ cwd: project.cwd });
    controller.back(project); setDrawer(false);
  };
  const toggleList = () => {
    if (listOpen) closeList();
    else if (layout.sizeClass === 'expanded' && resolveSidebarRoom(host.current, details)) setSidebar(true);
    else setDrawer(true);
  };
  useEffect(() => { props.onWorkspaceChange?.(cwd); }, [cwd, props.onWorkspaceChange]);
  useEffect(() => {
    controller.setViewing(enabled && !external && !overlay && !searching && !pickingDevice);
  }, [controller, enabled, external, overlay, searching, pickingDevice]);
  useEffect(() => {
    if (!active) { setDrawer(false); setSearching(false); setPickingDevice(false); setDetails(false); }
  }, [active]);
  const profile = <ChatProfileMenu client={controller.guiAccounts} deviceName={device?.name ?? ''}
    email={props.email} ready={state.ready} guiTools={controller.guiTools} active={enabled}
    running={view.running || state.sending} chooseDevice={chooseComputer} />;
  return <div className="dsh-workspace remodex-workspace" data-theme={preference}>
    <DshChatProviders controller={controller} state={state} active={enabled}>
      <ChatTerminalLayout>
      <div ref={host} className="dsh-chat-shell" data-left={layout.left} data-size={layout.sizeClass}
        data-overlay={overlay || undefined} onKeyDown={event => {
          if (event.key === 'Escape' && overlay) { event.stopPropagation(); closeList(); }
        }} data-detail={details ? layout.detail : undefined}
        style={{ '--dsh-detail-width': layout.detailWidth + 'px' } as React.CSSProperties}>
        {layout.left === 'rail' && <nav className="dsh-rail" aria-label={t('client.chat.chatList')}>
          <button className="dsh-icon-button" aria-label={t('client.chat.openChatList')} onClick={toggleList}>
            <PanelLeft size={20} /></button>
          <span className="dsh-rail-spacer" />{profile}
        </nav>}
        <aside className="dsh-sidebar" hidden={!listOpen} aria-label={t('client.chat.chatList')}>
          <header className="dsh-sidebar-heading"><strong>Remote AI</strong>
            <button className={desktop ? 'dsh-icon-button' : 'dsh-sidebar-new'}
              aria-label={t(desktop ? 'client.chat.collapseChatList' : 'client.workspaceSettings.newConversation')}
              disabled={!desktop && (state.sending || cli?.state.busy)} onClick={desktop ? closeList : () => newChat()}>
              {desktop ? <X size={20} /> : <><SquarePen size={20} />{t('client.workspaceSettings.newConversation')}</>}</button></header>
          {desktop ? <><ChatThreadFilter state={state} controller={controller} />
          <ChatThreads state={state} controller={controller} newChat={newChat}
            onClose={() => setDrawer(false)} openSearch={() => setSearching(true)} profile={profile} /></>
            : <DshMobileSidebar state={state} controller={controller} newChat={newChat} close={() => setDrawer(false)}
                search={() => setSearching(true)} openAccounts={props.openAccounts}
                openDiscover={props.openDiscover} openSettings={props.openSettings} />}
        </aside>
        {overlay && <button className="dsh-sidebar-scrim" aria-label={t('client.chat.collapseChatList')} onClick={closeList} />}
        <main className="dsh-chat-main">
          <header className="dsh-chat-header">
            {layout.left !== 'rail' && <button className="dsh-icon-button" aria-label={t('client.chat.openChatList')}
              onClick={toggleList}>{layout.sizeClass === 'compact' ? <ChevronLeft size={22} /> : <PanelLeft size={20} />}</button>}
            <button className="dsh-title-pill" onClick={() => setDetails(value => !value)} aria-expanded={details}>
              <strong>{external ? cli?.state.selected?.title ?? cli?.state.engine : title}</strong>
              <span><i className={'dsh-status-dot' + (view.running ? ' is-running' : '')} />
                <span className="dsh-device-label">{!state.ready ? t('client.chat.offline')
                  : device?.name || t(view.running ? 'client.chat.inProgress' : 'client.chat.online')}</span>
                {cwd && <small>· {cwd.split(/[\\/]/).filter(Boolean).at(-1)}</small>}</span>
            </button>
            <div className="remodex-header-actions">
              <button className="dsh-icon-button" aria-label={t('client.chat.chatSettings.1e06eb')}
                onClick={() => setDetails(value => !value)} aria-expanded={details}><Ellipsis size={21} /></button>
            </div>
          </header>
          <div className="dsh-notices"><ChatTaskStatus state={state} />
            {!!error && <p role="alert" className="chat-error">{displayError(error)}</p>}</div>
          <div className="dsh-codex-content" hidden={external}>
            <DshMessages state={state} controller={controller} view={view} active={enabled && !external} />
            <DshComposer {...props} chooseComputer={chooseComputer} active={active && !external} />
          </div>
          <CliConversationPane cwd={cwd} dictation={controller.dictation} remoteLayout
            active={enabled && external} connected={state.ready}
            connection={{ client: controller.guiAccounts, deviceName: device?.name ?? '', chooseDevice: chooseComputer }}
            projectPicker={<ChatProjectSwitch state={state} controller={controller} active={enabled} />} />
          <TaskRecoveryPrompt client={controller.taskRecovery} enabled={enabled && state.ready
            && state.taskRecoverySupported === true} openThread={id => { cli?.controller.showCodex();
              void controller.openRecoveryThread(id); }} />
        </main>
        <DshDetails {...props} open={details} presentation={layout.detail} close={() => setDetails(false)}
          chooseComputer={chooseComputer} />
        {searching && <ChatSearch state={state} controller={controller} onClose={() => setSearching(false)}
          select={thread => { cli?.controller.showCodex(); setSearching(false); setDrawer(false);
            void controller.select(thread); }} />}
        {pickingDevice && <ChatDevices devices={devices} refresh={deviceRefresh} onClose={() => setPickingDevice(false)}
          choose={id => { chooseDevice(id); setPickingDevice(false); }} />}
      </div></ChatTerminalLayout>
    </DshChatProviders>
  </div>;
}

function resolveSidebarRoom(host: HTMLElement | null, details: boolean) {
  const width = host?.clientWidth ?? 0;
  return width >= 920 + (details ? Math.min(420, Math.max(360, width * .3)) : 0);
}
