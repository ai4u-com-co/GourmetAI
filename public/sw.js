/* Service worker de VisualFeast. Hace instalable la app y deja la cáscara (HTML/JS/CSS/íconos) disponible sin conexión.
   NUNCA guarda ni intercepta /api/* ni las llamadas a Supabase: sesión, créditos e imágenes siempre van a la red. */
const CACHE = 'visualfeast-v1';
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Google, fuentes: directo a la red
  if (url.pathname.startsWith('/api/')) return;

  // Navegación: red primero (para tener siempre la versión nueva) y, sin conexión, la cáscara guardada.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  // Archivos estáticos (con hash en el nombre): del caché si están, si no de la red y se guardan.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith('/static/') || url.pathname.startsWith('/images/') || /\.(png|ico|svg|json)$/.test(url.pathname))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
