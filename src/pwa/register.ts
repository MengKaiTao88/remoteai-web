/** Cache the application shell only. Account, chat and file responses never enter this cache. */
export function registerPersonalPwa() {
  if (import.meta.env.VITE_PERSONAL_WEB !== 'true') return;
  document.documentElement.dataset.pocketWeb = '';
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    void navigator.serviceWorker.register(`${base}sw.js`, { scope: base, updateViaCache: 'none' })
      .catch(error => console.warn('Application shell registration failed', error));
  }, { once: true });
}
