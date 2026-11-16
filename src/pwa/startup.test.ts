// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { startupFallback } from '../../build/startupFallback';

it('offers startup retry, releases it on render and ignores later resource errors', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<section id="personal-startup"><p></p><button hidden></button><small></small></section>'
    + '<div id="root"></div>';
  window.eval(startupFallback().script);
  const script = document.createElement('script');
  document.head.append(script);
  script.dispatchEvent(new Event('error', { bubbles: true }));
  expect(document.querySelector('small')?.textContent).toBe('JS_RESOURCE');
  expect(document.querySelector('button')?.hidden).toBe(false);
  expect(document.querySelector('p')?.textContent).not.toContain('client.');
  document.getElementById('root')!.append(document.createElement('main'));
  await Promise.resolve();
  expect(document.getElementById('personal-startup')?.hidden).toBe(true);
  script.dispatchEvent(new Event('error', { bubbles: true }));
  expect(document.getElementById('personal-startup')?.hidden).toBe(true);
  vi.clearAllTimers();
  vi.useRealTimers();
});
