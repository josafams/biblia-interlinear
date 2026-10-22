// Gerado por scripts/build_web.mjs — não editar
const CACHE = "interlinear-e38d8725d6a7";
const FILES = ["./","account.js","annotations.js","dados/lex/G.js","dados/lex/H.js","fonts/atkinson-hyperlegible-latin-400-italic.woff2","fonts/atkinson-hyperlegible-latin-400-normal.woff2","fonts/atkinson-hyperlegible-latin-700-normal.woff2","fonts/atkinson-hyperlegible-latin-ext-400-italic.woff2","fonts/atkinson-hyperlegible-latin-ext-400-normal.woff2","fonts/atkinson-hyperlegible-latin-ext-700-normal.woff2","fonts/fonts.css","fonts/gentium-book-plus-greek-400-normal.woff2","fonts/gentium-book-plus-greek-700-normal.woff2","fonts/gentium-book-plus-greek-ext-400-normal.woff2","fonts/gentium-book-plus-greek-ext-700-normal.woff2","fonts/gentium-book-plus-latin-400-normal.woff2","fonts/gentium-book-plus-latin-700-normal.woff2","fonts/gentium-book-plus-latin-ext-400-normal.woff2","fonts/gentium-book-plus-latin-ext-700-normal.woff2","fonts/ibm-plex-mono-latin-400-normal.woff2","fonts/ibm-plex-mono-latin-500-normal.woff2","fonts/ibm-plex-mono-latin-ext-400-normal.woff2","fonts/ibm-plex-mono-latin-ext-500-normal.woff2","fonts/literata-greek-400-italic.woff2","fonts/literata-greek-400-normal.woff2","fonts/literata-greek-600-normal.woff2","fonts/literata-greek-ext-400-italic.woff2","fonts/literata-greek-ext-400-normal.woff2","fonts/literata-greek-ext-600-normal.woff2","fonts/literata-latin-400-italic.woff2","fonts/literata-latin-400-normal.woff2","fonts/literata-latin-600-normal.woff2","fonts/literata-latin-ext-400-italic.woff2","fonts/literata-latin-ext-400-normal.woff2","fonts/literata-latin-ext-600-normal.woff2","fonts/noto-serif-hebrew-hebrew-400-normal.woff2","fonts/noto-serif-hebrew-hebrew-600-normal.woff2","fonts/noto-serif-hebrew-latin-400-normal.woff2","fonts/noto-serif-hebrew-latin-600-normal.woff2","fonts/noto-serif-hebrew-latin-ext-400-normal.woff2","fonts/noto-serif-hebrew-latin-ext-600-normal.woff2","google-config.js","home.js","icones/apple-touch-icon.png","icones/favicon-64.png","icones/icone-192.png","icones/icone-512.png","icones/icone-maskable-512.png","index.html","ler.html","manifest.webmanifest","privacidade.html","progress.js","reader.js","search.js","study.js","sync.js","vendor/dexie.min.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Vídeos "Como usar": são regravados à parte do site, então o índice vem sempre da rede (com cópia para
  // usar sem internet) e os arquivos de vídeo não passam pelo cache (são grandes e chegam em partes).
  if (url.pathname.includes("/videos/")) {
    if (!url.pathname.endsWith("/videos.js")) return;
    e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }
  // Páginas (index.html, ler.html…): da rede quando há internet, para nunca mostrar uma versão antiga; o cache
  // fica para usar sem internet
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match("./"))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) c.put(e.request, r.clone());
    return r;
  }))));
});
