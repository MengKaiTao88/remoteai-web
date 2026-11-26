import { getLocale, t } from '../../../../shared/localization/browserClient';
import type { AuthSession, RemoteDevice } from '../types';
import { displayDate, maskEmail, resetLabel, usageTone } from './formatters';
import { type CockpitAccount, type CockpitQuotaWindow, useCockpitQuotas } from './useCockpitQuotas';

function percent(value: number | null | undefined) {
  return value == null ? '—' : new Intl.NumberFormat(getLocale(),
    { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
}

function updated(value: number | null) {
  return value ? t('client.mobileAccount.updated', { time: displayDate(new Date(value * 1000).toISOString()) })
    : t('client.accounts.notRefreshed');
}

function shortWindow(window: CockpitQuotaWindow | null) {
  return window?.windowMinutes
    ? t('client.usage.hours', { value1: window.windowMinutes / 60 }) : t('client.accounts.remainingQuota');
}

function QuotaWindow({ window, label }: { window: CockpitQuotaWindow | null; label: string }) {
  const remaining = window?.remainingPercent ?? null;
  return <div className={`cockpit-quota-window quota-${usageTone(remaining)}`}>
    <div><span>{label}</span><strong>{percent(remaining)}</strong></div>
    <span className="quota-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={remaining ?? undefined} aria-valuetext={percent(remaining)}>
      {remaining !== null && <i style={{ width: `${remaining}%` }} />}
    </span>
    {window?.resetAt && <small>{resetLabel(window.resetAt)}</small>}
  </div>;
}

function QuotaCard({ account, privateMode }: { account: CockpitAccount; privateMode: boolean }) {
  const identity = account.email || account.name;
  const identityLabel = identity ? (privateMode ? maskEmail(identity) : identity) : '—';
  return <article className="account-row cockpit-quota-card" data-quota-status={account.status}>
    <header className="account-row-identity">
      <strong title={identityLabel}>{identityLabel}</strong>
      {account.plan && <span className="plan-badge">{account.plan}</span>}
    </header>
    <div className="cockpit-quota-windows">
      <QuotaWindow window={account.hourly} label={shortWindow(account.hourly)} />
      <QuotaWindow window={account.weekly} label={t('client.mobileAccount.weekly', { quota: '' }).trim()} />
    </div>
    <footer>
      <small>{updated(account.updatedAt)}</small>
      {['stale', 'failed'].includes(account.status)
        && <small>{t('client.accounts.couldNotUpdateUsagePleaseTryAgainLater')}</small>}
    </footer>
  </article>;
}

export function CockpitQuotas({ session, device, active, revision, privateMode }: {
  session: AuthSession; device?: RemoteDevice; active: boolean; revision: number; privateMode: boolean;
}) {
  const state = useCockpitQuotas(session, device, active, revision);
  if (!state) return null;
  const pool = state.data?.pool;
  return <section className="cockpit-quotas" aria-labelledby="cockpit-quotas-heading">
    <header>
      <h2 id="cockpit-quotas-heading">Cockpit Tools · {t('client.accounts.remainingQuota')}</h2>
      <span>{device?.name}</span>
    </header>
    {(state.failed || pool?.stale) && <p role="status">{t('client.accounts.couldNotUpdateUsagePleaseTryAgainLater')}</p>}
    {pool && <dl className="mobile-account-averages">
      <div><dt>{t('client.mobileAccount.fiveHourAverage')}</dt><dd>{percent(pool.hourly)}</dd></div>
      <div><dt>{t('client.mobileAccount.weeklyAverage')}</dt><dd>{percent(pool.weekly)}</dd></div>
    </dl>}
    <div className="accounts-grid">{state.data?.accounts.map(account =>
      <QuotaCard key={account.id} account={account} privateMode={privateMode} />)}</div>
    {state.data?.accounts.length === 0 && <p>{t('client.accounts.usageUnavailable')}</p>}
  </section>;
}
