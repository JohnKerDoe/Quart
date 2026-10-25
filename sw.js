// Quart – service worker
// 1) Reçoit le CSV partagé depuis Android (share_target du manifest)
// 2) Garde l'appli disponible hors ligne

const APP_CACHE = 'quart-app-v1';
const SHARE_CACHE = 'quart-share';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== APP_CACHE && k !== SHARE_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Fichier partagé vers Quart : on le met de côté puis on ouvre l'appli avec ?shared
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const file = form.get('csv');
        if (file) {
          const cache = await caches.open(SHARE_CACHE);
          await cache.put(new URL('shared.csv', self.registration.scope).href,
            new Response(await file.text(), {
              headers: { 'Content-Type': 'text/plain', 'X-Name': encodeURIComponent(file.name || 'route.csv') }
            }));
        }
      } catch (err) {}
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }

  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Réseau d'abord (pour avoir la dernière version), cache si hors ligne
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(APP_CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
