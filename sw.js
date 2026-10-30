// Service worker: guarda o app e a base de km no aparelho (funciona sem internet) e
// mantém em cache os pedaços do mapa de fundo já vistos. A lista abaixo é preenchida no build.
const VERSAO = "9a84c7eb6137";
const ARQUIVOS = ["./","./banco-referencias.json","./catalogo-visual.json","./embedder-imagem.tflite","./eng.traineddata.gz","./error-BTdmRKoB.js","./esm-j-B9qRpW.js","./icone-180.png","./icone-192.png","./icone-512.png","./index-BnVr7XGy.css","./index-Cm9hIkRT.js","./index.html","./logo-dnit.png","./logo-houer-consane.png","./manifest.webmanifest","./maplibre-gl-worker-PS8qfxFK.js","./node.browser-2nWDoTG9.js","./node.browser-HQ5SKBOf.js","./ocr-worker.min.js","./pacote-snv-brasil.vtpkg","./pacote-to-km.vtpkg","./pdf-CCKktnNH.js","./pdf.worker.min-Dkey6ZUl.mjs","./sdk-BCE21g5F.js","./src-ChzTz_sY.js","./tesseract-core-simd-lstm.wasm.js","./vision_bundle-BYHKFn64.js","./vision_wasm_internal.js","./vision_wasm_internal.wasm"];
const CACHE_APP = `vistoria-to-app-${VERSAO}`;
const CACHE_MAPA = 'vistoria-to-mapa';
const LIMITE_MAPA = 4000;

// Só o essencial (página e código principal) precisa baixar para a versão instalar. O resto é guardado
// arquivo por arquivo: se faltar algum no site (upload incompleto), o app instala mesmo assim, baixa o
// arquivo quando ele aparecer e avisa na tela inicial quais faltam.
const essencial = (a) => a === './' || a === './index.html' || /^\.\/index-[\w-]+\.(js|css)$/.test(a);
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE_APP);
      // cache: 'reload' = pega do site, nunca do cache do navegador (senão a versão nova podia guardar o index.html antigo)
      await c.addAll(ARQUIVOS.filter(essencial).map((a) => new Request(a, { cache: 'reload' })));
      const r = await Promise.allSettled(ARQUIVOS.filter((a) => !essencial(a)).map((a) => c.add(new Request(a, { cache: 'reload' }))));
      const faltando = ARQUIVOS.filter((a) => !essencial(a)).filter((_, i) => r[i].status === 'rejected').map((a) => a.slice(2));
      await c.put('./_faltando.json', new Response(JSON.stringify({ versao: VERSAO, faltando }), { headers: { 'Content-Type': 'application/json' } }));
      await self.skipWaiting();
    })(),
  );
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
          fetch(req)
            .then((resp) => {
              // arquivo que faltou na instalação: guarda quando chegar
              const nome = './' + url.pathname.split('/').pop();
              if (resp.ok && ARQUIVOS.includes(nome)) {
                const copia = resp.clone();
                caches.open(CACHE_APP).then((c) => c.put(nome, copia));
              }
              return resp;
            })
            .catch(async () => (req.mode === 'navigate' ? (await caches.match('./index.html')) || (await caches.match('./')) : Response.error())),
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
