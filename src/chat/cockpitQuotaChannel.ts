import type { AuthSession } from '../types';

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
  resetCreditsAvailable?: number | null;
}

export interface CockpitQuotaSnapshot {
  accounts: CockpitAccount[];
  pool: { hourly: number | null; weekly: number | null; updatedAt: number | null; stale: boolean } | null;
}

type ReadQuotas = () => Promise<CockpitQuotaSnapshot>;
interface QuotaState {
  source: 'checking' | 'legacy' | 'cockpit';
  connected: boolean;
  refreshing: boolean;
  failed: boolean;
  data?: CockpitQuotaSnapshot;
}

export const INITIAL_QUOTA_STATE: QuotaState = { source: 'checking', connected: false, refreshing: false, failed: false };
const QUOTA_TIMEOUT_MS = 8_000;

export function quotaConnectionScope(session: AuthSession, deviceId: string | undefined | null) {
  return JSON.stringify([session.baseUrl, session.email, deviceId ?? '']);
}

function readWithDeadline(read: ReadQuotas) {
  return new Promise<CockpitQuotaSnapshot>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('COCKPIT_QUOTA_TIMEOUT')), QUOTA_TIMEOUT_MS);
    void Promise.resolve().then(read).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** The selected chat session also carries the read-only account operations. */
export class CockpitQuotaChannel {
  private state = INITIAL_QUOTA_STATE;
  private readonly listeners = new Set<() => void>();
  private read?: ReadQuotas;
  private pending?: Promise<void>;

  constructor(readonly scope: string) {}

  snapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(state: Partial<QuotaState>) {
    this.state = { ...this.state, ...state };
    for (const listener of this.listeners) listener();
  }

  accept(reply: unknown, read: ReadQuotas) {
    const supported = !!reply && typeof reply === 'object' && 'cockpitAccountsV1' in reply
      && reply.cockpitAccountsV1 === true;
    if (!supported) {
      this.read = undefined;
      this.pending = undefined;
      this.update({ ...INITIAL_QUOTA_STATE, source: 'legacy', connected: true, data: undefined });
      return;
    }
    this.read = read;
    this.update({ source: 'cockpit', connected: true, failed: false });
  }

  disconnect() {
    if (!this.state.connected) return;
    this.read = undefined;
    this.pending = undefined;
    this.update({ connected: false, refreshing: false });
  }

  unavailable() {
    if (!this.state.connected && !this.state.failed) this.update({ failed: true });
  }

  refresh = (): Promise<void> => {
    if (this.pending) return this.pending;
    if (!this.read) return Promise.resolve();
    const pending = readWithDeadline(this.read).then(data => {
      if (!Array.isArray(data?.accounts)) throw new Error('COCKPIT_QUOTA_RESPONSE_INVALID');
      if (this.pending === pending) this.update({ data, failed: false });
    }).catch(() => {
      if (this.pending === pending) this.update({ failed: true });
    }).finally(() => {
      if (this.pending !== pending) return;
      this.pending = undefined;
      this.update({ refreshing: false });
    });
    this.pending = pending;
    this.update({ refreshing: true });
    return pending;
  };
}
