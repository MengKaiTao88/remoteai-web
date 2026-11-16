import { DshComposerInput } from './DshComposerInput';
import { ChatAsyncQuestions } from '../../../../shared/remote-chat/views/ChatAsyncQuestions';
import { ChatProcessing } from '../../../../shared/remote-chat/views/ChatProcessing';
import { queueProps } from '../../../../shared/remote-chat/client/queueProps';
import { remotePromptSuggestion } from '../../../../shared/remote-chat/client/promptSuggestion';
import { compactUnavailableReason } from '../../../../shared/remote-chat/client/composerCommands';
import { useChatCatalog } from '../../../../shared/remote-chat/views/useChatCatalog';
import { currentRunningTurn } from '../../../../shared/chat/runningTurn';
import { t } from '../../../../shared/localization/browserClient';
import type { DshChatWorkspaceProps } from './DshChatWorkspace';

export function DshComposer({ chat, device, active, scope, chooseComputer, cliVersion }: DshChatWorkspaceProps & {
  chooseComputer: () => void;
}) {
  const { state, controller } = chat;
  const cwd = state.selected?.cwd ?? state.draftProject?.cwd ?? '';
  const catalog = useChatCatalog(controller, cwd, state.ready);
  const runningTurn = currentRunningTurn(state.selected?.turns);
  const enabled = active && chat.foreground;
  return <div className="dsh-composer-dock">
    {runningTurn && <ChatProcessing key={runningTurn.id} turn={runningTurn} processing={state.processing}
      active={enabled && state.ready} />}
    <ChatAsyncQuestions thread={state.selected} error={state.error} scope={scope}
      disabled={!state.ready || state.sending || state.settingsBusy || state.selectedArchived
        || state.queueBusy || state.compacting === state.selected?.id} answer={controller.answerAsyncQuestion} />
    <DshComposerInput suggestions={remotePromptSuggestion(state, controller.suggestNextPrompt, { scope })}
      dictation={controller.dictation} cliVersion={cliVersion}
      recoveredEdit={controller.messageEditor.recoveredDrafts.get(state.selected?.id ?? '')}
      consumeRecoveredEdit={() => controller.messageEditor.recoveredDrafts.delete(state.selected?.id ?? '')}
      readServiceStatus={controller.guiTools.serviceStatus}
      serviceStatusConnected={state.mode === 'direct' || state.mode === 'relay'}
      queue={queueProps(state, controller)}
      connection={{ client: controller.guiAccounts, deviceName: device?.name ?? t('client.settings.chooseAComputer'),
        chooseDevice: chooseComputer }}
      goals={controller.goals} goal={state.selected ? state.goals?.[state.selected.id] : null} goalBusy={!!state.goalBusy}
      contextSettings={controller.contextSettings} cwd={cwd} catalog={catalog}
      compactReason={compactUnavailableReason(state)}
      compacting={!!state.compacting && state.compacting === state.selected?.id} compact={controller.compact}
      loadCatalog={controller.loadComposerCatalog} loadFiles={controller.loadProjectFiles}
      loadConversations={controller.searchThreads} sshProfiles={controller.guiTools.terminal.ssh.profiles}
      uploadProgress={state.upload} threadId={state.selected?.id ?? null} draftScope={state.draftScope}
      models={state.models} selection={state.settings} readUsage={controller.readUsage} tokenUsage={state.selected?.tokenUsage}
      readConversationMetrics={controller.readConversationMetrics}
      settingsBusy={state.settingsBusy || !!state.workspaceBusy} settingsError={state.settingsError}
      accessUpdate={state.accessUpdate} updateSettings={patch => controller.setSettings(patch)}
      refreshModels={controller.refreshModels} active={enabled} ready={state.ready && !state.selectedArchived}
      sending={state.sending} running={!!runningTurn}
      interrupted={state.selected?.turns?.at(-1)?.status === 'interrupted'}
      send={input => controller.enqueueMessage(input)} interrupt={() => controller.interrupt()} />
  </div>;
}
