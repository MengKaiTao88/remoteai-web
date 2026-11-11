import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyTotpVault, mergeTotpVaults, totpVaultsEqual } from './totp';
import { useTotpCloudSync } from './useTotpCloudSync';
import type { AuthSession, TotpEntry, TotpVault } from './types';

const VAULT_PREFIX = 'codex-switch.web.totp-vault.v1';
const SYNC_PREFIX = 'codex-switch.web.totp-sync.v1';
const SYNC_EVENT = 'codex-switch:totp-sync';

function sessionKey(session: AuthSession, prefix: string) {
  return `${prefix}.${encodeURIComponent(`${session.baseUrl}|${session.email.toLowerCase()}`)}`;
}

function loadVault(session: AuthSession) {
  try {
    const raw = localStorage.getItem(sessionKey(session, VAULT_PREFIX));
    if (!raw) return emptyTotpVault();
    const value = JSON.parse(raw) as TotpVault;
    if (!Array.isArray(value.entries) || !Array.isArray(value.tombstones)) return emptyTotpVault();
    return value;
  } catch {
    return emptyTotpVault();
  }
}

function saveVault(session: AuthSession, vault: TotpVault) {
  localStorage.setItem(sessionKey(session, VAULT_PREFIX), JSON.stringify(vault));
}

export function loadTotpSyncEnabled(session: AuthSession) {
  return localStorage.getItem(sessionKey(session, SYNC_PREFIX)) === 'true';
}

export function saveTotpSyncEnabled(session: AuthSession, enabled: boolean) {
  localStorage.setItem(sessionKey(session, SYNC_PREFIX), String(enabled));
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export function useTotpVault(session: AuthSession | null) {
  const [vault, setVault] = useState<TotpVault>(emptyTotpVault);
  const [initialized, setInitialized] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const vaultRef = useRef(vault);
  const activeSessionRef = useRef(session);
  activeSessionRef.current = session;
  const identity = session ? sessionKey(session, VAULT_PREFIX) : '';

  const persist = useCallback((activeSession: AuthSession, next: TotpVault) => {
    if (activeSessionRef.current?.email !== activeSession.email
      || activeSessionRef.current?.baseUrl !== activeSession.baseUrl) return;
    vaultRef.current = next;
    setVault(next);
    saveVault(activeSession, next);
  }, []);

  useEffect(() => {
    const activeSession = activeSessionRef.current;
    if (!activeSession) {
      vaultRef.current = emptyTotpVault();
      setVault(emptyTotpVault());
      setCloudSyncEnabled(false);
      setInitialized(true);
      return undefined;
    }
    const local = loadVault(activeSession);
    const enabled = loadTotpSyncEnabled(activeSession);
    persist(activeSession, local);
    setCloudSyncEnabled(enabled);
    setInitialized(true);
    const onSyncChange = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== null
        && event.key !== sessionKey(activeSession, SYNC_PREFIX)
        && event.key !== sessionKey(activeSession, VAULT_PREFIX)) return;
      setCloudSyncEnabled(loadTotpSyncEnabled(activeSession));
      const merged = mergeTotpVaults(vaultRef.current, loadVault(activeSession));
      if (!totpVaultsEqual(merged, vaultRef.current)) persist(activeSession, merged);
    };
    window.addEventListener(SYNC_EVENT, onSyncChange);
    window.addEventListener('storage', onSyncChange);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSyncChange);
      window.removeEventListener('storage', onSyncChange);
    };
  }, [persist, identity]);

  const { syncing, syncCloud } = useTotpCloudSync({
    session, enabled: Boolean(session && loadTotpSyncEnabled(session)), vaultRef, persist,
  });

  const commit = useCallback((updater: (current: TotpVault, now: string) => TotpVault) => {
    if (!session) return;
    const next = updater(vaultRef.current, new Date().toISOString());
    persist(session, next);
    if (loadTotpSyncEnabled(session)) void syncCloud();
  }, [persist, session, syncCloud]);

  const refreshCloud = useCallback(async () => {
    if (!session) return 'empty' as const;
    return syncCloud(false);
  }, [session, syncCloud]);

  const saveEntry = useCallback((draft: Omit<TotpEntry, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    commit((current, now) => {
      const existing = id ? current.entries.find((entry) => entry.id === id) : undefined;
      const entry: TotpEntry = {
        ...draft,
        id: id ?? crypto.randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      return mergeTotpVaults(current, { entries: [entry], tombstones: [], modifiedAt: now });
    });
  }, [commit]);

  const deleteEntry = useCallback((id: string) => {
    commit((current, now) => mergeTotpVaults(
      current,
      { entries: [], tombstones: [{ id, deletedAt: now }], modifiedAt: now },
    ));
  }, [commit]);

  return {
    cloudSyncEnabled,
    deleteEntry,
    entries: vault.entries,
    initialized,
    refreshCloud,
    saveEntry,
    setCloudSyncEnabled: (enabled: boolean) => {
      if (!session) return;
      saveTotpSyncEnabled(session, enabled);
      setCloudSyncEnabled(enabled);
    },
    syncing,
  };
}
