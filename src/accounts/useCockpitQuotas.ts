import { useEffect, useRef, useState } from 'react';
import type { AuthSession, RemoteDevice } from '../types';
import { createWebChatConnection } from '../chat/webConnection';
import { chatHandshake } from '../../../../shared/remote-chat/handshake';

export interface CockpitQuotaWindow {
  remainingPercent: number | null;
  resetAt: number | null;
  windowMinutes: number | null;
}

export interface CockpitAccount {
  id: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  status: 'available' | 'stale' | 'unavailable' | 'failed';
  updatedAt: number | null;
  hourly: CockpitQuotaWindow | null;
  weekly: CockpitQuotaWindow | null;
}

interface Snapshot {
  accounts: CockpitAccount[];
  pool: { hourly: number | null; weekly: number | null; updatedAt: number | null; stale: boolean } | null;
}

const REFRESH_MS = 30_000;

export function useCockpitQuotas(session: AuthSession, device: RemoteDevice | undefined,
  active: boolean, revision: number) {
  const deviceId = device?.deviceId;
  const online = device?.online === true;
  const scope = JSON.stringify([session.baseUrl, session.email, deviceId]);
  const [state, setState] = useState<{ scope: string; data?: Snapshot; failed: boolean }>();
  const refresh = useRef<() => void>();
  useEffect(() => {
    if (!active || !deviceId || !online) return;
    let disposed = false, readInFlight = false, connected = false;
    let supported: boolean | undefined;
    const update = (failed: boolean, data?: Snapshot) => {
      if (!disposed) setState(previous => ({ scope, failed,
        data: data ?? (previous?.scope === scope ? previous.data : undefined) }));
    };
    const read = async () => {
      if (disposed || !connected || supported === false || readInFlight || document.visibilityState === 'hidden') return;
      readInFlight = true;
      try {
        if (supported === undefined) {
          const reply = await connection.request<{ cockpitAccountsV1?: boolean }>('connect', chatHandshake);
          supported = reply?.cockpitAccountsV1 === true;
        }
        if (supported && !disposed) {
          const data = await connection.request<Snapshot>('request', { operation: 'cockpitAccountQuotas' });
          if (!Array.isArray(data?.accounts)) throw new Error('COCKPIT_QUOTA_RESPONSE_INVALID');
          update(false, data);
        }
      } catch { if (supported) update(true); }
      finally { readInFlight = false; }
    };
    const connection = createWebChatConnection(session, deviceId, {
      mode: mode => {
        if (mode === 'offline' || mode === 'connecting') connected = false;
      },
      event: () => {},
      ready: () => { connected = true; void read(); },
      error: () => { connected = false; if (supported) update(true); },
    });
    const request = () => { void read(); };
    refresh.current = request;
    connection.start();
    const timer = window.setInterval(request, REFRESH_MS);
    document.addEventListener('visibilitychange', request);
    return () => {
      disposed = true;
      refresh.current = undefined;
      document.removeEventListener('visibilitychange', request);
      window.clearInterval(timer);
      connection.stop();
    };
  }, [scope, deviceId, online, active, session.baseUrl, session.email]);
  useEffect(() => { refresh.current?.(); }, [revision]);
  return state?.scope === scope ? { ...state, failed: state.failed || !online } : undefined;
}
