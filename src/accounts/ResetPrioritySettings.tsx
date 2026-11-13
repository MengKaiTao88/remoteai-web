import { useEffect, useState } from 'react';
import { Button, Switch, Toast } from 'antd-mobile';
import { displayError, t, useLanguage } from '../../../../shared/localization/browserClient';
import { AdaptiveSheet } from '../../../../shared/layout/AdaptiveSheet';
import type { ResetPriorityChange, ResetPriorityClient, ResetPriorityStatus }
  from '../../../../shared/remote-chat/resetPriority';
import type { AccountSummary, RemoteDevice } from '../types';
import { getActiveSession } from '../api';
import { useChat } from '../chat/useChat';
import { maskEmail, resetLabel } from './formatters';

export function ResetPrioritySettings({ devices, accounts, privateMode, onClose }: {
  devices: RemoteDevice[]; accounts: AccountSummary[]; privateMode: boolean; onClose: () => void;
}) {
  useLanguage();
  const online = devices.filter(device => device.online);
  const [selected, setSelected] = useState(online[0]?.deviceId ?? '');
  const device = online.find(item => item.deviceId === selected);
  const session = getActiveSession();
  return <AdaptiveSheet open title={t('client.resetPriority.title')} onClose={onClose} width={620}>
    <div className="reset-priority-settings">
      <label>{t('client.resetPriority.computer')}
        <select value={selected} onChange={event => setSelected(event.target.value)}>
          {online.map(item => <option key={item.deviceId} value={item.deviceId}>{item.name}</option>)}
        </select>
      </label>
      {!device || !session ? <p>{t('client.accounts.noDevicesOnlineOpenRemoteAiOnYourComputerFirst')}</p>
        : <ConnectedSettings key={JSON.stringify([session.baseUrl, session.email, device.deviceId])}
          session={session} deviceId={device.deviceId} accounts={accounts} privateMode={privateMode} />}
    </div>
  </AdaptiveSheet>;
}

function ConnectedSettings({ session, deviceId, ...props }: {
  session: NonNullable<ReturnType<typeof getActiveSession>>; deviceId: string;
  accounts: AccountSummary[]; privateMode: boolean;
}) {
  const chat = useChat(session, deviceId, true);
  return <ResetPriorityEditor client={chat.controller.guiTools.resetPriority}
    connected={chat.state.ready} {...props} />;
}

export function ResetPriorityEditor({ client, connected, accounts, privateMode }: {
  client: ResetPriorityClient; connected: boolean; accounts: AccountSummary[]; privateMode: boolean;
}) {
  useLanguage();
  const [status, setStatus] = useState<ResetPriorityStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setError('');
    if (connected) void client.read().then(value => { if (!cancelled) setStatus(value); })
      .catch(reason => { if (!cancelled) setError(displayError(reason)); });
    return () => { cancelled = true; };
  }, [client, connected, revision]);
  const save = async (change: ResetPriorityChange) => {
    if (busy) return;
    setBusy(true);
    try { setStatus(await client.set(change)); }
    catch (reason) { Toast.show({ icon: 'fail', content: displayError(reason) }); }
    finally { setBusy(false); }
  };
  return <>
    <p>{t('client.resetPriority.description')}</p>
    {error ? <p role="alert">{error}</p> : !status && <p>{t('client.accounts.loadingAccountDetails')}</p>}
    <Button size="small" disabled={!connected || busy} onClick={() => setRevision(value => value + 1)}>
      {t('client.accounts.refreshStatus')}</Button>
    {status && <>
      {!status.running && <p>{t('client.resetPriority.startProxy')}</p>}
      <label className="reset-priority-setting"><span>{t('client.resetPriority.autoSwitch')}</span>
        <Switch checked={status.autoSwitchOnQuotaExhaustion} disabled={!status.running || busy}
          onChange={enabled => save({ setting: 'autoSwitch', enabled })} /></label>
      <label className="reset-priority-setting"><span>{t('client.resetPriority.enabled')}</span>
        <Switch checked={status.autoSwitchPriorityByReset}
          disabled={!status.running || !status.autoSwitchOnQuotaExhaustion || busy}
          onChange={enabled => save({ setting: 'resetPriority', enabled })} /></label>
      <ul className="reset-priority-accounts">{[...status.accounts].sort((a, b) => a.priority - b.priority)
        .map(item => {
          const account = accounts.find(value => value.id === item.id);
          if (!account) return null;
          return <li key={item.id}>
            <span>{privateMode ? maskEmail(account.email) : account.email}
              <small>{resetLabel(item.secondaryResetsAt)}</small></span>
            <strong>{item.priority}</strong>
          </li>;
        })}</ul>
    </>}
  </>;
}
