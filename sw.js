// Service worker: guarda o app e a base de km no aparelho (funciona sem internet) e
// mantém em cache os pedaços do mapa de fundo já vistos. A lista abaixo é preenchida no build.
const VERSAO = "a1ed90d7eb88";
const ARQUIVOS = ["./","./catalogo-visual.json","./eng.traineddata.gz","./error-BTdmRKoB.js","./esm-j-B9qRpW.js","./icone-180.png","./icone-192.png","./icone-512.png","./index-DlKWX0Cp.css","./index-hrc4MZoU.js","./index.html","./logo-dnit.png","./logo-houer-consane.png","./manifest.webmanifest","./maplibre-gl-worker-PS8qfxFK.js","./node.browser-CTeB97U8.js","./node.browser-HQ5SKBOf.js","./ocr-worker.min.js","./pacote-to-km.vtpkg","./sdk-Ce2Db23h.js","./src-C8hZLxJH.js","./tesseract-core-simd-lstm.wasm.js"];
const CACHE_APP = `vistoria-to-app-${VERSAO}`;
const CACHE_MAPA = 'vistoria-to-mapa';
const LIMITE_MAPA = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_APP).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('vistoria-to-app-') && k !== CACHE_APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function aparar() {
  const c = await caches.open(CACHE_MAPA);
  const ks = await c.keys();
  for (let i = 0; i < ks.length - LIMITE_MAPA; i++) await c.delete(ks[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // App: primeiro o que está guardado; páginas caem no index.html.
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(
        (r) =>
          r ||
          fetch(req).catch(async () => (req.mode === 'navigate' ? (await caches.match('./index.html')) || (await caches.match('./')) : Response.error())),
      ),
    );
    return;
  }

  if (url.hostname.endsWith('openfreemap.org')) {
    // Mapa de fundo: usa o guardado e atualiza quando houver internet.
    e.respondWith(
      caches.open(CACHE_MAPA).then(async (c) => {
        const guardado = await c.match(req);
        const rede = fetch(req)
          .then((r) => {
            if (r.ok) {
              c.put(req, r.clone()).then(() => (Math.random() < 0.05 ? aparar() : undefined));
            }
            return r;
          })
          .catch(() => guardado || Response.error());
        return guardado || rede;
      }),
    );
  }
});
