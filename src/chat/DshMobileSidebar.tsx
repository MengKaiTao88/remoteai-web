import { useMemo, useState } from 'react';
import { ChevronDown, Compass, FolderPlus, LayoutDashboard, LoaderCircle, Plus, RefreshCw, Search, Settings, SquarePen } from 'lucide-react';
import { t, useLanguage } from '../../../../shared/localization/browserClient';
import type { ChatController, ChatProject, ChatState, Thread } from '../../../../shared/remote-chat/views/types';
import { BrowserGroups } from '../../../../shared/chat/groups/BrowserGroups';
import { GroupHeading } from '../../../../shared/chat/groups/GroupHeading';
import { flattenGroupingTree, groupingTree } from '../../../../shared/chat/groups/tree';
import { projectThreadGroups, threadPresentation } from '../../../../shared/remote-chat/sidebar';
import { remoteSidebarDrag } from '../../../../shared/remote-chat/client/sidebarDrag';
import { useThreadActions } from '../../../../shared/remote-chat/client/useThreadActions';
import { useProjectActions } from '../../../../shared/remote-chat/client/useProjectActions';
import { useRemoteProjectFolder } from '../../../../shared/chat/useRemoteProjectFolder';
import { useThreadListScroll } from '../../../../shared/remote-chat/views/useThreadListScroll';
import { ChatThreadRow } from '../../../../shared/remote-chat/views/ChatThreadRow';
import { ChatThreadActions } from '../../../../shared/remote-chat/views/ChatThreadActions';
import { ChatProjectHeading } from '../../../../shared/remote-chat/views/ChatProjectHeading';
import { ChatProjectActions } from '../../../../shared/remote-chat/views/ChatProjectActions';
import { useCliGui } from '../../../../shared/cli-gui/context';
import { useCliSidebar } from '../../../../shared/cli-gui/useCliSidebar';
import { CliThreadRow } from '../../../../shared/cli-gui/CliThreadRow';
import { ChatProjectPicker } from '../../../../shared/remote-chat/views/ChatProjectPicker';

interface Props {
  state: ChatState; controller: ChatController; close: () => void; search: () => void;
  newChat: (project?: ChatProject) => void;
  openAccounts?: () => void; openDiscover?: () => void; openSettings?: () => void;
}

/** The personal phone drawer reuses Remote AI's rows, actions, groups and pagination. */
export function DshMobileSidebar(props: Props) {
  return <BrowserGroups grouping={props.state.sidebar.grouping} client={props.controller.groups}
    drag={remoteSidebarDrag(props.state, props.controller)} translate={t} ready={props.state.ready} mobile>
    <SidebarContent {...props} />
  </BrowserGroups>;
}

function SidebarContent({ state, controller, close, search, newChat, ...pages }: Props) {
  useLanguage();
  const cli = useCliGui();
  const [recent, setRecent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const sidebar = useCliSidebar({ threads: state.threads, archived: state.archived });
  const groups = useMemo(() => flattenGroupingTree(groupingTree(
    projectThreadGroups(sidebar.threads, state.sidebar), state.sidebar.grouping), collapsed),
  [sidebar.threads, state.sidebar, collapsed]);
  const recentThreads = useMemo(() => [...sidebar.threads].sort((a, b) => b.updatedAt - a.updatedAt), [sidebar.threads]);
  const pagination = useThreadListScroll(state, controller);
  const actions = useThreadActions(state, controller);
  const projects = useProjectActions(state, controller);
  const { openProject, projectFolderDialog } = useRemoteProjectFolder({ controller, state, translate: t });
  const toggle = (id: string) => setCollapsed(previous => {
    const next = new Set(previous);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const row = (thread: Thread) => {
    const session = sidebar.session(thread);
    if (session) return <CliThreadRow key={thread.id} session={session} web onSelect={close} />;
    const { cwd } = threadPresentation(thread, state.sidebar);
    return <ChatThreadRow key={thread.id} thread={thread} state={state} actions={actions}
      select={() => { cli?.controller.showCodex(); void controller.select(thread); close(); }}
      onFork={() => { void controller.forkConversation(thread).then(opened => { if (opened) close(); }); }}
      onOpenProject={cwd ? () => openProject(cwd) : undefined} />;
  };
  return <>
    <div className="remodex-sidebar-actions">
      <button type="button" disabled={state.sending || cli?.state.busy} onClick={() => newChat()}>
        <span><SquarePen size={22} /></span>{t('client.chat.newChat')}</button>
      <button type="button" onClick={search}><span><Search size={22} /></span>{t('client.chat.searchChats')}</button>
      <button type="button" disabled={!state.ready || state.sending || cli?.state.busy} onClick={() => setCreating(true)}>
        <span><FolderPlus size={22} /></span>{t('client.conversation.newProject')}</button>
    </div>
    <button type="button" className="dsh-list-mode" aria-pressed={recent} onClick={() => {
      setRecent(value => !value);
      if (pagination.list.current) pagination.list.current.scrollTop = 0;
    }}>
      {t(recent ? 'client.workspaceActions.recentConversations' : 'client.groups.project')}
      <ChevronDown size={14} aria-hidden="true" />
    </button>
    <div className="chat-row chat-thread-controls">
      <button type="button" className="chat-search-trigger" onClick={search}>
        <Search size={18} />{t('client.chat.searchChats')}</button>
      <button type="button" className="chat-back" aria-label={t('client.chat.refreshChats')}
        disabled={!state.ready || state.listRefreshing} onClick={() => { void controller.list(); }}>
        <RefreshCw size={17} className={state.listRefreshing ? 'chat-spinner' : undefined} /></button>
    </div>
    <div ref={pagination.list} className="chat-scroll chat-thread-list" aria-busy={state.loading}>
      {recent ? recentThreads.map(row) : groups.map(group => {
        const label = group.kind === 'group' || group.cwd ? group.label
          : t(group.id === 'ungrouped' ? 'client.groups.ungrouped' : 'client.chat.recent');
        const folded = collapsed.has(group.id);
        return <section className="chat-project-group" aria-label={label} key={group.id}
          style={{ paddingInlineStart: Math.min(group.depth, 8) * 14 }}>
          {group.kind === 'group'
            ? <GroupHeading id={group.id.slice('group:'.length)} label={label} icon={group.icon}
                collapsed={folded} toggle={() => toggle(group.id)} />
            : <div className="chat-project-heading">
              <ChatProjectHeading project={{ ...group, label }} collapsed={folded} mobile
                pinned={Boolean(state.sidebar.pinnedProjects?.includes(group.cwd))}
                toggle={() => toggle(group.id)} openActions={() => projects.open({ ...group, label })} />
              {group.cwd && <button type="button" className="chat-back"
                aria-label={t('client.chat.startAChatIn', { value1: label })} disabled={state.sending}
                onClick={() => newChat(group)}><Plus size={18} /></button>}
            </div>}
          {!folded && group.data.map(row)}
        </section>;
      })}
      {!sidebar.threads.length && <p className="chat-empty chat-muted">
        {t(state.ready ? 'client.chat.noChatsYet' : 'client.chat.connectToYourComputerToViewChats')}</p>}
      <div className="chat-thread-pagination">
        {pagination.loadingMore && <span role="status" className="chat-muted chat-row">
          <LoaderCircle size={16} className="chat-spinner" />{t('client.projectBrowser.loading')}</span>}
        {state.cursor && pagination.failed && <button type="button" className="chat-button"
          disabled={!state.ready || state.loading} onClick={pagination.retry}>
          {t('client.chat.couldNotLoadSelectToRetry')}</button>}
      </div>
    </div>
    <nav className="dsh-mobile-links">
      <button type="button" onClick={pages.openDiscover}><Compass size={21} />{t('client.discovery.title')}</button>
      <button type="button" onClick={pages.openSettings}><Settings size={21} />{t('client.app.settings')}</button>
      <button type="button" onClick={pages.openAccounts}><LayoutDashboard size={21} />{t('client.app.accounts')}</button>
    </nav>
    <ChatThreadActions actions={actions} />
    <ChatProjectActions actions={projects} />
    {creating && <ChatProjectPicker cwd={state.draftProject?.cwd ?? ''}
      projects={groups.filter(group => group.cwd).map(group => ({ cwd: group.cwd, label: group.label }))}
      title={t('client.conversation.newProject')} mutate={controller.guiTools.projectBrowser.mutate}
      load={controller.loadProjectDirectories} close={() => setCreating(false)}
      choose={project => { setCreating(false); newChat(project); }} />}
    {projectFolderDialog}
  </>;
}
