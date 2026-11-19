import { accountSourceLabel } from '../../../../shared/accounts/source';
import { t, useLanguage } from '../../../../shared/localization/browserClient';
import { Button } from 'antd-mobile';
import { Check, Clock3, RefreshCw, Ticket } from 'lucide-react';
import type { AccountSummary } from '../types';
import { maskEmail, remainingPercent, resetLabel, usageErrorLabel, usageTone } from './formatters';

export function AccountCard({ account, privateMode, switching, busy, onOpen, onSwitch, mobile }: {
  account: AccountSummary; privateMode: boolean; switching: boolean; busy: boolean;
  mobile?: { current: boolean; credits: number | undefined };
  onOpen: () => void; onSwitch: () => void;
}) {
  useLanguage();
  const email = privateMode ? maskEmail(account.email) : account.email;
  const remaining = remainingPercent(account.usage.primary?.remainingPercent);
  const plan = account.plan || 'ChatGPT';
  const weekly = remainingPercent(account.usage.secondary?.remainingPercent);
  return <article className={`account-row plan-${plan.toLowerCase()} quota-${usageTone(remaining)}`}
    data-mobile-current={mobile?.current || undefined}>
    <button type="button" className="account-row-main" onClick={onOpen} aria-label={t("client.accounts.accountDetailsFor", { value1: email })}>
      <span className="account-row-identity"><span className="plan-badge">{plan}</span><strong>{email}</strong>
        {mobile && <span className="mobile-account-weekly">{t("client.mobileAccount.weekly", { quota: weekly === null ? '—' : `${weekly}%` })}</span>}
        {mobile?.current ? <span className="mobile-account-current"><Check size={12} aria-hidden="true" />
          {t("client.mobileAccount.current")}</span>
          : <small title={mobile ? t("client.officialAccounts.source") : undefined}>
            {!mobile && `${t("client.officialAccounts.source")}: `}{accountSourceLabel(account)}</small>}</span>
      <span className="account-row-meter">
        <span className="quota-track" role="progressbar" aria-label={t("client.accounts.remainingQuota")} aria-valuemin={0}
          aria-valuemax={100} aria-valuenow={remaining ?? undefined}
          aria-valuetext={remaining === null ? t("client.accounts.usageUnavailable") : `${remaining}%`}>
          <i style={{ width: `${remaining ?? 0}%` }} />
        </span><b>{remaining === null ? '--' : `${remaining}%`}</b>
      </span>
      <span className="account-row-reset"><Clock3 size={15} aria-hidden="true" />
        <span>{remaining === null ? t("client.accounts.usageUnavailable") : resetLabel(account.usage.primary?.resetsAt)}</span>
        {mobile && <span className="mobile-account-credits"><Ticket size={15} aria-hidden="true" />
          {t("client.mobileAccount.credits", { count: mobile.credits ?? '—' })}</span>}</span>
      {account.usage.error && <span className="account-row-error">{usageErrorLabel(account.usage.error)}</span>}
    </button>
    {!mobile && <Button className="account-switch" loading={switching} disabled={busy} onClick={onSwitch}
      aria-label={t("client.accounts.switchToAccount", { value1: email })}><RefreshCw size={19} /><span>{t("client.accounts.switch")}</span></Button>}
  </article>;
}
