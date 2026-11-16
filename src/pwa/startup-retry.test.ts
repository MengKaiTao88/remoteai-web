// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { startupFallback } from '../../build/startupFallback';

it('waits for streamed markup and binds Retry before the application script can run', async () => {
  vi.useFakeTimers();
  const remove = vi.fn(async () => true);
  const registrations = vi.fn(() => new Promise<never>(() => {}));
  vi.stubGlobal('caches', { keys: async () => ['remoteai-shell:/personal/:old',
    'remoteai-shell:/other/:old', 'unrelated'], delete: remove });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true,
    value: { getRegistrations: registrations } });
  try {
    document.body.innerHTML = '<section id="personal-startup"></section><div id="root"></div>';
    window.eval(startupFallback('/personal/').script);
    await Promise.resolve();
    const script = document.createElement('script');
    document.head.append(script);
    script.dispatchEvent(new Event('error', { bubbles: true }));
    document.getElementById('personal-startup')!.innerHTML = '<p></p><button hidden></button><small></small>';
    await Promise.resolve();
    const button = document.querySelector('button')!;
    expect(button.hidden).toBe(false);
    expect(document.querySelector('small')?.textContent).toBe('JS_RESOURCE');
    const retryLabel = button.textContent;
    button.click();
    expect(button.disabled).toBe(true);
    expect(button.textContent).not.toBe(retryLabel);
    for (let index = 0; index < 8; index++) await Promise.resolve();
    expect(registrations).toHaveBeenCalledOnce();
    expect(remove.mock.calls).toEqual([['remoteai-shell:/personal/:old']]);
  } finally {
    document.getElementById('root')?.append(document.createElement('main'));
    await Promise.resolve();
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.unstubAllGlobals();
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});
