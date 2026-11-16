import { expect, it } from 'vitest';
import { resolveDshLayout } from './dshLayout';

it('uses compact height for a landscape phone and a sheet for a tablet', () => {
  expect(resolveDshLayout({ width: 915, height: 412, sidebar: true, details: true }))
    .toMatchObject({ sizeClass: 'compact', left: 'none', detail: 'page' });
  expect(resolveDshLayout({ width: 768, height: 1024, sidebar: true, details: true }))
    .toMatchObject({ sizeClass: 'medium', left: 'none', detail: 'sheet' });
});
it('folds the sidebar before details can squeeze the reading column', () => {
  const normal = resolveDshLayout({ width: 1100, height: 900, sidebar: true, details: false });
  const detail = resolveDshLayout({ width: 1100, height: 900, sidebar: true, details: true });
  expect(normal.left).toBe('sidebar');
  expect(detail.left).toBe('rail');
  expect(1100 - 68 - detail.detailWidth).toBeGreaterThanOrEqual(400);
  expect(resolveDshLayout({ width: 1500, height: 900, sidebar: true, details: true }).left).toBe('sidebar');
});
