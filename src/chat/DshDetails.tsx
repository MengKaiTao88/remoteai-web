import { useEffect, useState } from 'react';
import { RemodexDialog } from './RemodexDialog';
import { ChatContextSettings } from '../../../../shared/remote-chat/views/ChatContextSettings';
import { X } from 'lucide-react';
import { t } from '../../../../shared/localization/browserClient';
import { ChatProjectSwitch } from '../../../../shared/remote-chat/views/ChatProjectSwitch';
import { ChatConnectionInfo } from '../../../../shared/remote-chat/views/ChatConnectionInfo';
import { ChatProfileMenu } from '../../../../shared/remote-chat/views/ChatProfileMenu';
import { DshModelPicker } from './DshModelPicker';
import { ComposerAccess } from '../../../../shared/remote-chat/views/ComposerDesktopControls';
import { ChatUsage } from '../../../../shared/remote-chat/views/ChatUsage';
import type { DshChatWorkspaceProps } from './DshChatWorkspace';
import type { DshLayout } from './dshLayout';

export function DshDetails({ chat, device, headerActions, open, presentation, close, chooseComputer }: DshChatWorkspaceProps & {
  open: boolean; presentation: DshLayout['detail']; close: () => void; chooseComputer: () => void;
}) {
  const { controller, state } = chat;
  const [contextOpen, setContextOpen] = useState(false);
  useEffect(() => { if (!open) setContextOpen(false); }, [open]);
  useEffect(() => { setContextOpen(false); }, [state.selected?.id]);
  const connection = { client: controller.guiAccounts, deviceName: device?.name ?? t('client.settings.chooseAComputer'),
    chooseDevice: chooseComputer };
  const content = <>
      <header className="dsh-details-heading"><strong>{t('client.chat.accountAndComputer')}</strong>
        <button className="dsh-icon-button" aria-label={t('client.chat.closeDetailsPanel')} onClick={close}>
          <X size={20} /></button></header>
      <ChatConnectionInfo controller={controller} state={state} device={device} active={open}
        chooseDevice={chooseComputer} />
      <ChatProfileMenu {...connection} variant="settings" ready={state.ready} active={open}
        cliLocked={!!state.selected} cliCwd={state.selected?.cwd} />
      <ChatProjectSwitch state={state} controller={controller} active={open} />
      <div className="dsh-details-options">
        <DshModelPicker models={state.models} selection={state.settings} ready={state.ready}
          active={open && chat.foreground}
          scope={state.selected?.id ?? state.draftScope} settingsError={state.settingsError}
          settingsBusy={state.settingsBusy} updateSettings={patch => controller.setSettings(patch)}
          refreshModels={controller.refreshModels} beforeOpen={() => {}} />
        <ComposerAccess selection={state.settings} settingsBusy={state.settingsBusy}
          accessUpdate={state.accessUpdate} updateSettings={patch => controller.setSettings(patch)}
          beforeOpen={() => {}} />
      </div>
      <ChatUsage read={controller.readUsage} active={open && chat.foreground} ready={state.ready}
        tokenUsage={state.selected?.tokenUsage} card readConversationMetrics={controller.readConversationMetrics}
        threadId={state.selected?.id ?? null}
        onContextSettings={state.selected ? () => setContextOpen(true) : undefined} />
      <div className="dsh-detail-tools">{headerActions}</div>
      {contextOpen && state.selected && <ChatContextSettings threadId={state.selected.id}
        api={controller.contextSettings} onClose={() => setContextOpen(false)} />}
  </>;
  if (!open) return null;
  return <>
    {presentation === 'panel' ? <aside className="dsh-details-panel" data-presentation="panel"
      aria-label={t('client.chat.accountAndComputer')}>{content}</aside>
      : <RemodexDialog label={t('client.chat.accountAndComputer')} close={close}
        className="dsh-details-panel" presentation={presentation}>{content}</RemodexDialog>}
  </>;
}
