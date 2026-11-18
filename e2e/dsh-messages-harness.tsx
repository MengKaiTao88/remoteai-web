import { createRoot } from 'react-dom/client';
import { Profiler, useEffect, useMemo, useState } from 'react';
import { initializeTheme, useThemeMode } from '../src/theme/preference';
import { App as AntApp, ConfigProvider } from 'antd';
import { WebLocaleProvider } from '../src/i18n/WebLocaleProvider';

import { DshMessages } from '../src/chat/DshMessages';
import { DshComposerInput } from '../src/chat/DshComposerInput';
import type { ComposerProps } from '../../../shared/remote-chat/views/composerProps';
import { deriveDshRows } from '../src/chat/dshViewModel';
import { initialChatState } from '../../../shared/remote-chat/client/types';
import type { ChatController } from '../../../shared/remote-chat/client/controller';
import type { Item, Thread } from '../../../shared/conversation/types';
import { ChatPresentation } from '../../../shared/remote-chat/views/ChatPresentation';
import { ChatImageContext } from '../../../shared/remote-chat/views/ChatImage';
import { ImageCache } from '../../../shared/remote-chat/client/imageCache';
import { ProcessDetailsContext } from '../../../shared/chat/DeferredProcessDetails';

import 'antd/dist/reset.css';
import '../../../shared/remote-chat/views/chat.css';
import '../src/chat/assistantChat.css';


initializeTheme();
const imageRetry = new URLSearchParams(location.search).has('image-retry');
const imageCanvas = document.createElement('canvas');
imageCanvas.width = 480; imageCanvas.height = 260;
const imageContext = imageCanvas.getContext('2d')!;
imageContext.fillStyle = '#ddd'; imageContext.fillRect(0, 0, 480, 260);
imageContext.fillStyle = '#222'; imageContext.font = '24px sans-serif'; imageContext.fillText('Chat image fixture', 120, 140);
const fixtureImage = imageCanvas.toDataURL();
let imageReads = 0;
const imageCache = new ImageCache(async <T,>() => {
  document.body.dataset.imageReads = String(++imageReads);
  return { url: imageReads === 1 ? 'data:image/png;base64,YmFk' : fixtureImage } as T;
});
const imageThread: Thread = { id: 'fixture', cwd: '/workspace', preview: '', updatedAt: 0, turns: [
  { id: 'image-turn', status: 'completed', items: [
    { id: 'sent-image', type: 'userMessage', content: [{ type: 'text', text: 'Check the sent image.' },
      { type: 'localImage', path: '/workspace/screenshot.png' }] },
    { id: 'answer-image', type: 'agentMessage', phase: 'final_answer', text: 'Here is the answer image.',
      content: [{ type: 'image', url: fixtureImage }] },
  ] },
] };
const stress = new URLSearchParams(location.search).has('stress');
const deferred = new URLSearchParams(location.search).has('deferred');
const sequence = new URLSearchParams(location.search).has('sequence');
const longProcess = new URLSearchParams(location.search).has('long-process');
const metrics = { updates: 0, commits: 0, renderTotal: 0, renderMax: 0, pulse: 0,
  mountDuration: 0, initialMarkdown: 0, initialActivities: 0 };
Object.assign(window, { dshPerformance: metrics });
const composer = {
  models: [{ id: 'model', model: 'model', displayName: 'Fixture model', isDefault: true,
    defaultReasoningEffort: 'medium', supportedReasoningEfforts: [{ reasoningEffort: 'medium', description: '' }] }],
  selection: { model: 'model', effort: 'medium', access: 'workspace-write' },
  settingsBusy: false, settingsError: '', threadId: 'fixture', active: true, ready: true, sending: false,
  running: true, cwd: '/workspace', compacting: false, compactReason: null,
  goals: { load: async () => undefined, clear: async () => false },
  catalog: { skills: [], plugins: [], loading: false, refresh: () => {} },
  connection: {}, updateSettings: async () => {}, refreshModels: async () => {}, interrupt: async () => {},
  send: async () => true, compact: async () => false,
} as unknown as ComposerProps;
const tools: Item[] = ['one', 'two', 'three'].map(id => ({
  id, type: 'commandExecution', command: 'echo ' + id, status: 'completed', aggregatedOutput: 'OUTPUT_' + id,
}));
const base: Thread = { id: 'fixture', preview: '', cwd: '/workspace', updatedAt: 1, turns: [
  { id: 'complete', status: 'completed', items: [
    { id: 'user', type: 'userMessage', text: '源码调研完成后再修改。' },
    ...(sequence ? [{ id: 'before-tools', type: 'reasoning', summary: ['**Before tools**\nInitial check.'] }] : []),
    ...(deferred ? [{ id: 'deferred-summary', type: 'processSummary', activityCount: 4,
      processRef: { threadId: 'fixture', turnId: 'complete', itemId: 'one', endItemId: 'three' } }]
      : longProcess ? Array.from({ length: 80 }, (_, index) => ({ ...tools[0], id: `operation-${index}` })) : tools),
    ...(sequence ? [{ id: 'after-tools', type: 'reasoning', summary: ['**After tools**\nSubsequent check.'] },
      { id: 'commentary-sequence', type: 'agentMessage', phase: 'commentary' as const, text: 'Narrative after execution.' }] : []),
    { id: 'answer', type: 'agentMessage', phase: 'final_answer', text: '已读取源码。最终回答保持展开。' },
  ] },
  { id: 'failed', status: 'interrupted', items: [
    { id: 'second', type: 'userMessage', text: '检查失败过程。' },
    { id: 'visible-tool', type: 'commandExecution', command: 'check failure', status: 'failed',
      aggregatedOutput: 'FAILED_OUTPUT', exitCode: 1 },
  ] },
] };
const stressThread: Thread = { ...base, turns: [
  ...Array.from({ length: 500 }, (_, index) => ({ id: 'past-' + index, status: 'completed', items: [
    { id: 'past-u-' + index, type: 'userMessage', text: 'Review the project and preserve existing functionality. ' + index },
    { id: 'past-a-' + index, type: 'agentMessage', phase: 'final_answer' as const,
      text: 'The review is complete.\n\n' + 'Existing functions remain available. '.repeat(20) },
  ] })),
  { id: 'live', status: 'inProgress', items: [
    ...Array.from({ length: 600 }, (_, index) => index % 2 ? {
      id: 'live-' + index, type: 'commandExecution', status: 'completed', command: 'inspect module ' + index,
      aggregatedOutput: 'Retained diagnostic output.\n'.repeat(20), exitCode: 0,
    } : { id: 'live-' + index, type: 'agentMessage', phase: 'commentary' as const,
      text: 'Checking [the implementation](https://example.test/source.ts).\n\n```ts\nconst preserved = true;\n```\n\n'
        + 'The current change preserves the surrounding behavior. '.repeat(8) }),
    { id: 'stream', type: 'agentMessage', phase: 'final_answer', text: '# Live response\n\nSettled paragraph.\n\nStreaming update 0' },
  ] },
] };
function Harness() {
  const theme = useThemeMode();
  const [thread, setThread] = useState(imageRetry ? imageThread : stress ? stressThread : base);
  const [hasMore, setHasMore] = useState(false);
  const [approvals, setApprovals] = useState(imageRetry ? [] : [{ id: 1, method: 'item/commandExecution/requestApproval',
    params: { threadId: 'fixture', reason: '运行本地检查', command: 'npm test' } }]);
  const state = { ...initialChatState(), ready: true, selected: thread, approvals, historyHasMore: hasMore };
  useEffect(() => {
    if (!stress) return;
    const timer = setInterval(() => {
      if (metrics.updates >= 120) return;
      metrics.updates++;
      setThread(current => ({ ...current, turns: [...current.turns!.slice(0, -1), {
        ...current.turns!.at(-1)!, items: [...current.turns!.at(-1)!.items.slice(0, -1), {
          id: 'stream', type: 'agentMessage', phase: 'final_answer', text: '# Live response\n\nSettled paragraph.\n\nStreaming update ' + metrics.updates,
        }],
      }] }));
    }, 100);
    return () => clearInterval(timer);
  }, []);
  const controller = useMemo(() => ({
    loadOlder: async () => {
      setHasMore(false);
      setThread(current => ({ ...current, turns: [{ id: 'old', status: 'completed', items: Array.from({ length: 35 },
        (_, index) => ({ id: 'old-' + index, type: 'agentMessage', phase: 'final_answer' as const,
          text: '更早记录 ' + index + '\n\n' + '历史内容。'.repeat(15) })) }, ...current.turns!] }));
    },
    respond: async (reply: { decision: string }) => { document.body.dataset.decision = reply.decision; setApprovals([]); },
    messageEditor: { submit: async () => true, remove: async () => true },
  } as unknown as ChatController), []);
  const view = deriveDshRows({ thread, approvals, queue: [] });
  const history = <Profiler id="history" onRender={(_id, _phase, duration) => {
    if (!metrics.commits++) {
      metrics.mountDuration = duration;
      metrics.initialMarkdown = document.querySelectorAll('.chat-markdown').length;
      metrics.initialActivities = document.querySelectorAll('.official-activity-line').length;
      return;
    }
    metrics.renderTotal += duration; metrics.renderMax = Math.max(metrics.renderMax, duration);
  }}><DshMessages state={state} controller={controller} view={view} active /></Profiler>;
  return <ConfigProvider><AntApp><div className="dsh-workspace remodex-workspace" data-theme={theme} style={{ height: '100dvh' }}>
    {stress && <button data-testid="performance-pulse" style={{ position: 'fixed', left: 4, top: 4, zIndex: 30 }}
      onClick={() => { metrics.pulse++; document.body.dataset.pulse = String(metrics.pulse); }}>Pulse</button>}
    {!imageRetry && <button data-testid="enable-history" style={{ position: 'fixed', right: 4, top: 4, zIndex: 20 }}
      onClick={() => setHasMore(true)}>Enable fixture history</button>}
    <ChatPresentation.Provider value={{ taskCards: true }}>
    <ChatImageContext.Provider value={{ threadId: 'fixture', ready: true, load: (thread, source, original, options) =>
      imageCache.load(thread, source, original, options?.refresh) }}>
    <ProcessDetailsContext.Provider value={{ active: true, load: async () => { document.body.dataset.processReads = String(Number(document.body.dataset.processReads ?? 0) + 1);
        return { items: deferred ? [{ id: 'deferred-thinking', type: 'reasoning', summary: ['**Inspect source**\nRead real details.\n\n**Verify behavior**\nCheck the result.'] }, ...tools] : tools }; } }}>
      {stress ? <div className="dsh-chat-main"><header className="dsh-chat-header">Long conversation fixture</header>
        <div className="dsh-codex-content">{history}<div className="dsh-composer-dock">
          <p className="chat-processing-status">Streaming task</p><DshComposerInput {...composer} />
        </div></div></div> : history}
    </ProcessDetailsContext.Provider></ChatImageContext.Provider></ChatPresentation.Provider>
  </div></AntApp></ConfigProvider>;
}
createRoot(document.getElementById('root')!).render(<WebLocaleProvider><Harness /></WebLocaleProvider>);
