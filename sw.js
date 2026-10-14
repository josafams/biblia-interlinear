// Gerado por scripts/build_web.mjs — não editar
const CACHE = "interlinear-184ff246b4bc";
const FILES = ["./","dados/lex/G.js","dados/lex/H.js","fonts/atkinson-hyperlegible-latin-400-italic.woff2","fonts/atkinson-hyperlegible-latin-400-normal.woff2","fonts/atkinson-hyperlegible-latin-700-normal.woff2","fonts/atkinson-hyperlegible-latin-ext-400-italic.woff2","fonts/atkinson-hyperlegible-latin-ext-400-normal.woff2","fonts/atkinson-hyperlegible-latin-ext-700-normal.woff2","fonts/fonts.css","fonts/gentium-book-plus-greek-400-normal.woff2","fonts/gentium-book-plus-greek-700-normal.woff2","fonts/gentium-book-plus-greek-ext-400-normal.woff2","fonts/gentium-book-plus-greek-ext-700-normal.woff2","fonts/gentium-book-plus-latin-400-normal.woff2","fonts/gentium-book-plus-latin-700-normal.woff2","fonts/gentium-book-plus-latin-ext-400-normal.woff2","fonts/gentium-book-plus-latin-ext-700-normal.woff2","fonts/ibm-plex-mono-latin-400-normal.woff2","fonts/ibm-plex-mono-latin-500-normal.woff2","fonts/ibm-plex-mono-latin-ext-400-normal.woff2","fonts/ibm-plex-mono-latin-ext-500-normal.woff2","fonts/literata-greek-400-italic.woff2","fonts/literata-greek-400-normal.woff2","fonts/literata-greek-600-normal.woff2","fonts/literata-greek-ext-400-italic.woff2","fonts/literata-greek-ext-400-normal.woff2","fonts/literata-greek-ext-600-normal.woff2","fonts/literata-latin-400-italic.woff2","fonts/literata-latin-400-normal.woff2","fonts/literata-latin-600-normal.woff2","fonts/literata-latin-ext-400-italic.woff2","fonts/literata-latin-ext-400-normal.woff2","fonts/literata-latin-ext-600-normal.woff2","fonts/noto-serif-hebrew-hebrew-400-normal.woff2","fonts/noto-serif-hebrew-hebrew-600-normal.woff2","fonts/noto-serif-hebrew-latin-400-normal.woff2","fonts/noto-serif-hebrew-latin-600-normal.woff2","fonts/noto-serif-hebrew-latin-ext-400-normal.woff2","fonts/noto-serif-hebrew-latin-ext-600-normal.woff2","icones/apple-touch-icon.png","icones/favicon-64.png","icones/icone-192.png","icones/icone-512.png","icones/icone-maskable-512.png","index.html","ler.html","manifest.webmanifest","privacidade.html"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) c.put(e.request, r.clone());
    return r;
  }))));
});
