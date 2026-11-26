import { getLocale, t } from '../../../../shared/localization/browserClient';
import { Clock3, RefreshCw, Ticket } from 'lucide-react';
import { displayDate, maskEmail, resetLabel, usageTone } from './formatters';
import type { CockpitAccount, CockpitQuotaChannel, CockpitQuotaWindow } from '../chat/cockpitQuotaChannel';
import { SpinLoading } from 'antd-mobile';

function percent(value: number | null | undefined) {
  return value == null ? '—' : new Intl.NumberFormat(getLocale(),
    { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
}

function QuotaUpdatedAt({ timestamp }: { timestamp: number | null }) {
  const date = new Date((timestamp ?? 0) * 1000);
  if (!timestamp || !Number.isFinite(date.getTime())) return <>{t('client.accounts.notRefreshed')}</>;
  const iso = date.toISOString();
  return <time dateTime={iso}>{t('client.mobileAccount.updated', { time: displayDate(iso) })}</time>;
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

function QuotaCard({ account }: { account: CockpitAccount }) {
  const identity = account.email || account.name;
  const identityLabel = identity ? maskEmail(identity) : '—';
  const credits = account.resetCreditsAvailable;
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
      <small><QuotaUpdatedAt timestamp={account.updatedAt} /></small>
      <small className="mobile-account-credits"><Ticket size={14} aria-hidden="true" />
        {t('client.mobileAccount.credits', { count: typeof credits === 'number' && Number.isSafeInteger(credits)
          && credits >= 0 ? credits : '—' })}
      </small>
      {['stale', 'failed'].includes(account.status)
        && <small>{t('client.accounts.couldNotUpdateUsagePleaseTryAgainLater')}</small>}
    </footer>
  </article>;
}

export function CockpitQuotas({ deviceName, state, refresh }: {
  deviceName?: string; state: ReturnType<CockpitQuotaChannel['snapshot']>; refresh: () => Promise<void>;
}) {
  const { accounts, pool } = state.data ?? {};
  const latest = accounts?.reduce((newest, account) => Math.max(newest, account.updatedAt ?? 0), 0) || null;
  const loading = state.connected && !state.data && !state.failed;
  return <section className="cockpit-quotas" aria-labelledby="cockpit-quotas-heading">
    <header>
      <div className="mobile-accounts-toolbar">
        <span><Clock3 size={14} aria-hidden="true" /><QuotaUpdatedAt timestamp={latest} /></span>
        <button type="button" disabled={!state.connected || state.refreshing} onClick={() => void refresh()}
          aria-busy={state.refreshing} aria-label={t('client.accounts.refreshAllUsage')}>
          <RefreshCw size={15} aria-hidden="true" className={state.refreshing ? 'spin' : undefined} />
          {t('client.chat.refresh')}
        </button>
      </div>
      <div className="cockpit-quota-heading">
        <h2 id="cockpit-quotas-heading">Cockpit Tools · {t('client.accounts.remainingQuota')}</h2>
        <span>{deviceName}</span>
      </div>
    </header>
    {loading && <div className="page-loading" role="status"><SpinLoading />{t('client.accounts.loadingAccounts')}</div>}
    {!state.connected && <p role="status">{t('client.accounts.usageUnavailable')}</p>}
    {(state.failed || pool?.stale) && <p role="status">{t('client.accounts.couldNotUpdateUsagePleaseTryAgainLater')}</p>}
    {pool && <dl className="mobile-account-averages">
      <div><dt>{t('client.mobileAccount.fiveHourAverage')}</dt><dd>{percent(pool.hourly)}</dd></div>
      <div><dt>{t('client.mobileAccount.weeklyAverage')}</dt><dd>{percent(pool.weekly)}</dd></div>
    </dl>}
    <div className="accounts-grid">{accounts?.map(account =>
      <QuotaCard key={account.id} account={account} />)}</div>
    {accounts?.length === 0 && <p>{t('client.accounts.usageUnavailable')}</p>}
  </section>;
}
