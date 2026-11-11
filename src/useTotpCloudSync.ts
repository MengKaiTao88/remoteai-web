import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Toast } from 'antd-mobile';
import { t } from '../../../shared/localization/browserClient';
import { fetchTotpVault, putTotpVault } from './api';
import { mergeTotpVaults, totpVaultsEqual } from './totp';
import type { AuthSession, TotpVault } from './types';

const SYNC_INTERVAL_MS = 30_000;
type SyncResult = 'empty' | 'current' | 'updated';
interface Options {
  session: AuthSession | null;
  enabled: boolean;
  vaultRef: MutableRefObject<TotpVault>;
  persist: (session: AuthSession, vault: TotpVault) => void;
}

export function useTotpCloudSync(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const identity = options.session ? `${options.session.baseUrl}|${options.session.email.toLowerCase()}` : '';
  const generation = useRef({ identity });
  if (generation.current.identity !== identity) generation.current = { identity };
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    generation.current = { identity };
    return () => { generation.current = { identity: '' }; };
  }, [identity]);

  const syncCloud = useCallback((upload = true, background = false): Promise<SyncResult> => {
    const session = latest.current.session;
    if (!session || (background && pending.current > 0)) return Promise.resolve('current');
    const expected = generation.current;
    const current = () => generation.current === expected && latest.current.session !== null;
    pending.current += 1;
    setSyncing(true);
    const operation = queue.current.catch(() => undefined).then(async (): Promise<SyncResult> => {
      if (!current()) return 'current';
      const remote = await fetchTotpVault(session);
      if (!current()) return 'current';
      const local = latest.current.vaultRef.current;
      const merged = remote.modifiedAt ? mergeTotpVaults(local, remote) : local;
      const changed = !totpVaultsEqual(merged, local);
      if (changed) latest.current.persist(session, merged);
      if (upload && latest.current.enabled
        && (!remote.modifiedAt || !totpVaultsEqual(merged, remote))) {
        const response = await putTotpVault(merged, session);
        if (current()) latest.current.persist(session, mergeTotpVaults(latest.current.vaultRef.current, response));
      }
      return changed ? 'updated' : remote.modifiedAt ? 'current' : 'empty';
    }).catch(error => {
      if (!current()) return 'current' as const;
      if (!upload) throw error;
      if (!background) {
        Toast.show({ icon: 'fail', content: t('client.settings.cloudSyncFailedYourLocalKeysAreSafePleaseTry') });
      }
      return 'current' as const;
    }).finally(() => {
      pending.current -= 1;
      if (pending.current === 0) setSyncing(false);
    });
    queue.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    if (!identity || !options.enabled) return;
    void syncCloud();
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void syncCloud(true, true);
    };
    const timer = window.setInterval(refresh, SYNC_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [identity, options.enabled, syncCloud]);

  return { syncing, syncCloud };
}
