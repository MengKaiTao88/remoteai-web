import { useEffect, useState } from 'react';
import { getLocale, t } from '../../../../shared/localization/browserClient';
import { fetchResetCredits } from '../api';
import type { AccountSummary, AuthSession } from '../types';

function average(accounts: AccountSummary[], window: 'primary' | 'secondary') {
  const values = accounts.flatMap(account => {
    const value = account.usage[window]?.remainingPercent;
    return typeof value === 'number' && Number.isFinite(value) ? [Math.min(100, Math.max(0, value))] : [];
  });
  return values.length ? new Intl.NumberFormat(getLocale(), {
    style: 'percent', maximumFractionDigits: 1,
  }).format(values.reduce((sum, value) => sum + value, 0) / (100 * values.length)) : '—';
}

export function MobileAccountAverages({ accounts }: { accounts: AccountSummary[] }) {
  return <dl className="mobile-account-averages">
    <div><dt>{t("client.mobileAccount.fiveHourAverage")}</dt><dd>{average(accounts, 'primary')}</dd></div>
    <div><dt>{t("client.mobileAccount.weeklyAverage")}</dt><dd>{average(accounts, 'secondary')}</dd></div>
  </dl>;
}

export function useMobileResetCredits(enabled: boolean, session: AuthSession, accounts: AccountSummary[], revision: number) {
  const ids = JSON.stringify(accounts.map(account => account.id).sort());
  const scope = JSON.stringify([session.baseUrl, session.email, ids]);
  const [snapshot, setSnapshot] = useState<{ scope: string; counts: Record<string, number> }>();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const remaining: string[] = JSON.parse(ids);
    let next = 0;
    const load = async () => {
      while (active && next < remaining.length) {
        const id = remaining[next++];
        try {
          const { credits } = await fetchResetCredits(id);
          if (active) setSnapshot(previous => ({
            scope, counts: { ...(previous?.scope === scope ? previous.counts : {}), [id]: credits.length },
          }));
        } catch { /* This account's count can be requested again with the usage refresh. */ }
      }
    };
    void Promise.all(Array.from({ length: Math.min(4, remaining.length) }, load));
    return () => { active = false; };
  }, [enabled, ids, scope, revision]);
  return snapshot?.scope === scope ? snapshot.counts : {};
}
