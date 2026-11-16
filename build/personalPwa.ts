import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Opt-in static hosting output; the normal author-hosted build is unchanged. */
export function personalPwa(enabled: boolean, publicUrl?: string): Plugin {
  let base = '/';
  return {
    name: 'personal-web-pwa',
    configResolved(config) { base = config.base; },
    transformIndexHtml(html) {
      if (!enabled) return html;
      const url = `${base}manifest.webmanifest`;
      const document = publicUrl ? html.replaceAll('https://codex.onepiper.cloud/web/', publicUrl)
        : html.replace(/<link rel="canonical"[^>]*>/, '').replace(/<meta property="og:url"[^>]*>/, '');
      return { html: document, tags: [
        { tag: 'link', attrs: { rel: 'manifest', href: url }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}codex-switch.png` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
      ] };
    },
    generateBundle(_options, bundle) {
      if (!enabled) return;
      const files = Object.keys(bundle).filter(name => name.startsWith('assets/') || name === 'index.html');
      const index = bundle['index.html'];
      const hash = createHash('sha256').update(files.join('|')
        + String(index?.type === 'asset' ? index.source : '')).digest('hex');
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify({
        id: './', name: 'Remote AI', short_name: 'Remote AI', lang: 'zh-CN', start_url: './', scope: './',
        display: 'standalone', background_color: '#f4f4f5', theme_color: '#f4f4f5',
        icons: [{ src: 'codex-switch.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
      }) });
      this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker({ base, files, hash }) });
    },
  };
}

export function serviceWorker({ base, files, hash }: { base: string; files: string[]; hash: string }) {
  const urls = ['index.html', 'codex-switch.png', ...files.filter(name => name !== 'index.html')];
  return `const CACHE = ${JSON.stringify(`remoteai-shell:${base}:${hash.slice(0,16)}`)};
const PREFIX = ${JSON.stringify(`remoteai-shell:${base}:`)};
const BASE = ${JSON.stringify(base)};
const SHELL = ${JSON.stringify(urls.map(name => base + name))};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin
    || request.headers.has('Authorization')) return;
  if (request.mode === 'navigate' && (url.pathname === BASE || url.pathname === BASE + 'index.html')) {
    event.respondWith(fetch(request).catch(() => caches.match(BASE + 'index.html')));
    return;
  }
  if (url.search || !SHELL.includes(url.pathname) || url.pathname === BASE + 'index.html') return;
  event.respondWith(caches.match(request, { ignoreVary: true }).then(cached => cached || fetch(request)));
});
`;
}
