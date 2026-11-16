import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { initializeTheme, useThemeMode } from '../src/theme/preference';
import { App as AntApp, ConfigProvider } from 'antd';
import { WebLocaleProvider } from '../src/i18n/WebLocaleProvider';

import { DshMessages } from '../src/chat/DshMessages';
import { deriveDshRows } from '../src/chat/dshViewModel';
import { initialChatState } from '../../../shared/remote-chat/client/types';
import type { ChatController } from '../../../shared/remote-chat/client/controller';
import type { Item, Thread } from '../../../shared/conversation/types';
import { ProcessDetailsContext } from '../../../shared/chat/DeferredProcessDetails';

import 'antd/dist/reset.css';
import '../../../shared/remote-chat/views/chat.css';
import '../src/chat/dshChatWorkspace.css';


initializeTheme();
const tools: Item[] = ['one', 'two', 'three'].map(id => ({
  id, type: 'commandExecution', command: 'echo ' + id, status: 'completed', aggregatedOutput: 'OUTPUT_' + id,
}));
const base: Thread = { id: 'fixture', preview: '', cwd: '/workspace', updatedAt: 1, turns: [
  { id: 'complete', status: 'completed', items: [
    { id: 'user', type: 'userMessage', text: '源码调研完成后再修改。' },
    ...tools, { id: 'answer', type: 'agentMessage', phase: 'final_answer', text: '已读取源码。最终回答保持展开。' },
  ] },
  { id: 'failed', status: 'interrupted', items: [
    { id: 'second', type: 'userMessage', text: '检查失败过程。' },
    { id: 'visible-tool', type: 'commandExecution', command: 'check failure', status: 'failed',
      aggregatedOutput: 'FAILED_OUTPUT', exitCode: 1 },
  ] },
] };
function Harness() {
  const theme = useThemeMode();
  const [thread, setThread] = useState(base);
  const [hasMore, setHasMore] = useState(false);
  const [approvals, setApprovals] = useState([{ id: 1, method: 'item/commandExecution/requestApproval',
    params: { threadId: 'fixture', reason: '运行本地检查', command: 'npm test' } }]);
  const state = { ...initialChatState(), ready: true, selected: thread, approvals, historyHasMore: hasMore };
  const controller = {
    loadOlder: async () => {
      setHasMore(false);
      setThread(current => ({ ...current, turns: [{ id: 'old', status: 'completed', items: Array.from({ length: 35 },
        (_, index) => ({ id: 'old-' + index, type: 'agentMessage', phase: 'final_answer' as const,
          text: '更早记录 ' + index + '\n\n' + '历史内容。'.repeat(15) })) }, ...current.turns!] }));
    },
    respond: async (reply: { decision: string }) => { document.body.dataset.decision = reply.decision; setApprovals([]); },
    messageEditor: { submit: async () => true, remove: async () => true },
  } as unknown as ChatController;
  const view = deriveDshRows({ thread, approvals, queue: [] });
  return <ConfigProvider><AntApp><div className="dsh-workspace" data-theme={theme} style={{ height: '100dvh' }}>
    <button data-testid="enable-history" style={{ position: 'fixed', right: 4, top: 4, zIndex: 20 }}
      onClick={() => setHasMore(true)}>Enable fixture history</button>
    <ProcessDetailsContext.Provider value={{ active: true, load: async () => ({ items: tools }) }}>
      <DshMessages state={state} controller={controller} view={view} active />
    </ProcessDetailsContext.Provider>
  </div></AntApp></ConfigProvider>;
}
createRoot(document.getElementById('root')!).render(<WebLocaleProvider><Harness /></WebLocaleProvider>);
