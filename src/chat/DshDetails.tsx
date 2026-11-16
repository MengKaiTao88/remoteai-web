import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { t } from '../../../../shared/localization/browserClient';
import { ChatProjectSwitch } from '../../../../shared/remote-chat/views/ChatProjectSwitch';
import { ChatConnectionInfo } from '../../../../shared/remote-chat/views/ChatConnectionInfo';
import { ChatProfileMenu } from '../../../../shared/remote-chat/views/ChatProfileMenu';
import { ComposerModelPicker } from '../../../../shared/remote-chat/views/ComposerModelPicker';
import { ComposerAccess } from '../../../../shared/remote-chat/views/ComposerDesktopControls';
import { ChatUsage } from '../../../../shared/remote-chat/views/ChatUsage';
import type { DshChatWorkspaceProps } from './DshChatWorkspace';
import type { DshLayout } from './dshLayout';

export function DshDetails({ chat, device, headerActions, open, presentation, close, chooseComputer }: DshChatWorkspaceProps & {
  open: boolean; presentation: DshLayout['detail']; close: () => void; chooseComputer: () => void;
}) {
  const { controller, state } = chat;
  const panel = useRef<HTMLElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => lastFocus.current?.focus();
  }, [open]);
  const connection = { client: controller.guiAccounts, deviceName: device?.name ?? t('client.settings.chooseAComputer'),
    chooseDevice: chooseComputer };
  return <>
    {open && presentation !== 'panel' && <button className="dsh-detail-scrim"
      aria-label={t('client.chat.closeDetailsPanel')} onClick={close} />}
    <aside ref={panel} className="dsh-details-panel" data-presentation={presentation} hidden={!open}
      role={presentation === 'panel' ? 'complementary' : 'dialog'} aria-modal={presentation !== 'panel' || undefined}
      aria-label={t('client.chat.accountAndComputer')} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); close(); }
      }}>
      <header className="dsh-details-heading"><strong>{t('client.chat.accountAndComputer')}</strong>
        <button className="dsh-icon-button" aria-label={t('client.chat.closeDetailsPanel')} onClick={close}>
          <X size={20} /></button></header>
      <ChatConnectionInfo controller={controller} state={state} device={device} active={open}
        chooseDevice={chooseComputer} />
      <ChatProfileMenu {...connection} variant="settings" ready={state.ready} active={open}
        cliLocked={!!state.selected} cliCwd={state.selected?.cwd} />
      <ChatProjectSwitch state={state} controller={controller} active={open} />
      <div className="dsh-details-options">
        <ComposerModelPicker models={state.models} selection={state.settings} ready={state.ready}
          settingsBusy={state.settingsBusy} updateSettings={patch => controller.setSettings(patch)}
          refreshModels={controller.refreshModels} beforeOpen={() => {}} />
        <ComposerAccess selection={state.settings} settingsBusy={state.settingsBusy}
          accessUpdate={state.accessUpdate} updateSettings={patch => controller.setSettings(patch)}
          beforeOpen={() => {}} />
      </div>
      <ChatUsage read={controller.readUsage} active={open && chat.foreground} ready={state.ready}
        tokenUsage={state.selected?.tokenUsage} card readConversationMetrics={controller.readConversationMetrics}
        threadId={state.selected?.id ?? null} />
      <div className="dsh-detail-tools">{headerActions}</div>
    </aside>
  </>;
}
