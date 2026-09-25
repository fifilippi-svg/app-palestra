/* Service worker — app palestra
   - Pagina: prima dalla rete (così gli aggiornamenti arrivano subito), se non c'è rete o è lenta usa la copia salvata.
   - Altri file (icone, manifest): dalla copia salvata, aggiornata in background. */
const CACHE_NAME = "ipertrofia-cache-v7";
const ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request, { cache: "no-store" }).then(
      (r) => { clearTimeout(t); resolve(r); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Pagina principale: network-first con timeout
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetchWithTimeout(req, NETWORK_TIMEOUT_MS);
        if (res && res.ok) {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((c) => c.put("./index.html", copy)));
        }
        return res;
      } catch (e) {
        return (await caches.match(req)) || (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Altri file: cache, aggiornata in background
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        return caches.open(CACHE_NAME).then((c) => c.put(req, copy)).then(() => res);
      }
      return res;
    });
    if (cached) {
      event.waitUntil(network.catch(() => {}));
      return cached;
    }
    return network.catch(() => Response.error());
  })());
});
