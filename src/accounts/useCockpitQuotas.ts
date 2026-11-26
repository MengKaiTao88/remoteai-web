import { useEffect, useSyncExternalStore } from 'react';
import { INITIAL_QUOTA_STATE, type CockpitQuotaChannel } from '../chat/cockpitQuotaChannel';

const REFRESH_MS = 30_000;
const idle = () => () => {};
const initial = () => INITIAL_QUOTA_STATE;

export function useCockpitQuotas(channel: CockpitQuotaChannel | null, active: boolean) {
  const state = useSyncExternalStore(channel?.subscribe ?? idle, channel?.snapshot ?? initial);
  useEffect(() => {
    if (!active || !channel || state.source !== 'cockpit' || !state.connected) return;
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void channel.refresh();
    };
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [active, channel, state.source, state.connected]);
  return state;
}
