import { defineConfig } from '@playwright/test';
import chat from './playwright.chat.config';

const servers = Array.isArray(chat.webServer) ? chat.webServer : [];

export default defineConfig({
  ...chat,
  testMatch: '**/personal-mobile.pw.ts',
  expect: { timeout: 15_000 },
  outputDir: '../../../.codex-tmp/personal-mobile-playwright',
  reporter: [['list'], ['html', { outputFolder: '../../../.codex-tmp/personal-mobile-report', open: 'never' }]],
  projects: [
    { name: 'phone-light', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'phone-dark', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'phone-narrow-large', use: { viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-preserved', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: servers.map((server, index) =>
    index === 1 ? { ...server, env: { ...server.env, VITE_PERSONAL_WEB: 'true' } } : server),
});
