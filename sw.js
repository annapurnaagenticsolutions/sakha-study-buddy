const CACHE_NAME = 'sakha-v9';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './config.js',
    './privacy.html',
    './style.css',
    './manifest.json',
    './favicon.ico',
    './icon512.png',
    './content/concept-index-lite.json',
    './content/all_concepts.json',
    './dist/main.js',
    './dist/physics.wasm'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames.map((cacheName) => {
                if (cacheName !== CACHE_NAME) {
                    return caches.delete(cacheName);
                }
                return null;
            })
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    if (
        url.hostname.includes('workers.dev') ||
        url.hostname.includes('api.groq.com') ||
        url.hostname.includes('huggingface.co') ||
        url.hostname.includes('mlc.ai')
    ) {
        return;
    }

    if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', responseToCache));
                    return networkResponse;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            });
        })
    );
});
