import { expect, it, vi } from 'vitest';
import { CockpitQuotaChannel, type CockpitQuotaSnapshot } from './cockpitQuotaChannel';

it('coalesces quota reads and retains the last snapshot when a refresh fails', async () => {
  const channel = new CockpitQuotaChannel('same-device');
  const snapshot: CockpitQuotaSnapshot = { accounts: [], pool: null };
  const read = vi.fn<() => Promise<CockpitQuotaSnapshot>>().mockResolvedValueOnce(snapshot)
    .mockRejectedValueOnce(new Error('temporary failure'));
  channel.accept({ cockpitAccountsV1: true }, read);
  const first = channel.refresh();
  expect(channel.refresh()).toBe(first);
  expect(channel.snapshot().refreshing).toBe(true);
  await first;
  expect(read).toHaveBeenCalledTimes(1);
  expect(channel.snapshot()).toMatchObject({ data: snapshot, source: 'cockpit', failed: false, refreshing: false });
  await channel.refresh();
  expect(channel.snapshot()).toMatchObject({ data: snapshot, failed: true, refreshing: false });
});

it('discards a superseded quota response and uses capability detection for older PCs', async () => {
  const channel = new CockpitQuotaChannel('same-device');
  const read = vi.fn(async () => ({ accounts: [], pool: null }));
  channel.accept({ cockpitAccountsV1: true }, read);
  const obsolete = channel.refresh();
  channel.disconnect();
  channel.accept({ protocolVersion: 1 }, read);
  await obsolete;
  await channel.refresh();
  expect(read).toHaveBeenCalledTimes(1);
  expect(channel.snapshot()).toMatchObject({ source: 'legacy', connected: true, data: undefined });
});

it('unblocks refresh when the computer stops replying and ignores the late snapshot', async () => {
  vi.useFakeTimers();
  try {
    const channel = new CockpitQuotaChannel('same-device');
    const previous = { accounts: [], pool: null };
    const replacement = { accounts: [], pool: { hourly: 50, weekly: 25, updatedAt: 100, stale: false } };
    let finish!: (data: CockpitQuotaSnapshot) => void;
    const stalled = new Promise<CockpitQuotaSnapshot>(resolve => { finish = resolve; });
    const read = vi.fn<() => Promise<CockpitQuotaSnapshot>>().mockResolvedValueOnce(previous)
      .mockReturnValueOnce(stalled).mockResolvedValueOnce(replacement);
    channel.accept({ cockpitAccountsV1: true }, read);
    await channel.refresh();
    const pending = channel.refresh();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(channel.snapshot()).toMatchObject({ data: previous, failed: true, refreshing: false });
    await pending;
    await channel.refresh();
    finish(previous);
    await vi.advanceTimersByTimeAsync(0);
    expect(channel.snapshot()).toMatchObject({ data: replacement, failed: false, refreshing: false });
  } finally { vi.useRealTimers(); }
});
