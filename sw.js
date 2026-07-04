const CACHE_NAME = 'sakha-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './src/main.js',
    './src/agent.js',
    './src/components.js',
    './src/voice.js',
    './src/vision.js',
    './src/galaxy.js',
    './src/p2p.js',
    // We will dynamically cache /lib/ files and /content/concepts/ as they are requested
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
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Cache-first strategy for performance
self.addEventListener('fetch', (event) => {
    // Exclude API calls like Groq or HuggingFace from Service Worker cache
    if (event.request.url.includes('api.groq.com') || event.request.url.includes('huggingface.co')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            
            return fetch(event.request).then((networkResponse) => {
                // Dynamically cache new local requests (like /lib/ or /content/)
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
