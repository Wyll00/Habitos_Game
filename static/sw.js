const CACHE = 'habitos-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Estáticos (versionados con ?v=): cache-first para carga instantánea
  if (url.pathname.startsWith('/static/')) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
        return res;
      }))
    );
    return;
  }

  // Navegación: red primero; copia en caché como respaldo si no hay conexión
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put('/', clone));
        return res;
      }).catch(() => caches.match('/'))
    );
    return;
  }
  // El resto (APIs) va a la red normal, sin interceptar.
});
