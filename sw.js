const CACHE_NAME = 'secureon-wallet-v2.0.0';
const ASSETS = [
    './',
    './index.html',
    './landing.html',
    './tutorial.html',
    './termos.html',
    './privacidade.html',
    './suporte.html',
    './manifest.json',
    './favicon.svg',
    './favicon-32x32.png',
    './icon-192.png',
    './icon-512.png',
    './tailwind_compiled.css',
    './style.css',
    './ethers.js',
    './qrcode.js',
    './common.js',
    './security.js',
    './crypto.js',
    './storage.js',
    './tokens.js',
    './blockchain.js',
    './app.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(err => {
                console.warn('Pre-cache partial warning:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // Ignore RPC network calls (they must go directly to the blockchain)
    const url = event.request.url;
    if (url.includes('llamarpc.com') || url.includes('ankr.com') || url.includes('cloudflare-eth.com') || url.includes('etherscan.io') || url.includes('sepolia')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If good response and same origin, cache it
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If offline, return cached version
                return caches.match(event.request);
            })
    );
});
