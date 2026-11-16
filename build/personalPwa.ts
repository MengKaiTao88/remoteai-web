import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { startupFallback } from './startupFallback';

/** Opt-in static hosting output; the normal author-hosted build is unchanged. */
export function personalPwa(enabled: boolean, publicUrl?: string): Plugin {
  let base = '/';
  return {
    name: 'personal-web-pwa',
    enforce: 'pre',
    configResolved(config) { base = config.base; },
    transform(source, id) {
      if (!enabled || !id.replaceAll('\\', '/').endsWith('/src/styles.css')) return;
      return source.replace(/@import url\("https:\/\/fonts\.googleapis\.com\/[^"\n]+"\);\s*/, '');
    },
    transformIndexHtml(html) {
      if (!enabled) return html;
      const url = `${base}manifest.webmanifest`;
      const document = publicUrl ? html.replaceAll('https://codex.onepiper.cloud/web/', publicUrl)
        : html.replace(/<link rel="canonical"[^>]*>/, '').replace(/<meta property="og:url"[^>]*>/, '');
      const fallback = startupFallback();
      return { html: document, tags: [
        { tag: 'style', children: fallback.css, injectTo: 'head-prepend' },
        { tag: 'script', children: fallback.script, injectTo: 'head-prepend' },
        { tag: 'section', attrs: { id: 'personal-startup', role: 'status' },
          children: '<strong>Remote AI</strong><p></p><button type="button" hidden></button><small></small>',
          injectTo: 'body-prepend' },
        { tag: 'link', attrs: { rel: 'manifest', href: url }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}codex-switch.png` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
      ] };
    },
    generateBundle(_options, bundle) {
      if (!enabled) return;
      const files = Object.keys(bundle).filter(name => name.startsWith('assets/') || name === 'index.html');
      const essential = new Set<string>();
      const visit = (name: string) => {
        if (essential.has(name)) return;
        const output = bundle[name];
        if (!output) return;
        essential.add(name);
        if (output.type === 'chunk') output.imports.forEach(visit);
      };
      Object.values(bundle).forEach(output => { if (output.type === 'chunk' && output.isEntry) visit(output.fileName); });
      files.filter(name => /\.(css|png|webp)$/.test(name)).forEach(name => essential.add(name));
      const index = bundle['index.html'];
      const hash = createHash('sha256').update(files.join('|')
        + String(index?.type === 'asset' ? index.source : '')).digest('hex');
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify({
        id: './', name: 'Remote AI', short_name: 'Remote AI', lang: 'zh-CN', start_url: './', scope: './',
        display: 'standalone', background_color: '#f4f4f5', theme_color: '#f4f4f5',
        icons: [{ src: 'codex-switch.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
      }) });
      this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker({
        base, files, hash, essential: [...essential],
      }) });
    },
  };
}

export function serviceWorker({ base, files, hash, essential = files }: {
  base: string; files: string[]; hash: string; essential?: string[];
}) {
  const urls = ['index.html', 'codex-switch.png', ...files.filter(name => name !== 'index.html')];
  return `const CACHE = ${JSON.stringify(`remoteai-shell:${base}:${hash.slice(0,16)}`)};
const PREFIX = ${JSON.stringify(`remoteai-shell:${base}:`)};
const BASE = ${JSON.stringify(base)};
const SHELL = ${JSON.stringify(urls.map(name => base + name))};
const ESSENTIAL = ${JSON.stringify(['index.html', 'codex-switch.png', ...essential.filter(name => name !== 'index.html')]
    .map(name => base + name))};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    for (const url of ESSENTIAL) await cache.add(url);
  }));
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
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }));
});
`;
}
