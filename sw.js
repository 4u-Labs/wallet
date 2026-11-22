const CACHE_NAME = '4ulabs-wallet-v3';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

    // Network-first for HTML/PHP/navigations so updates always load immediately
    if (req.mode === 'navigate' || url.pathname.endsWith('.php') || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
        event.respondWith(
            fetch(req).then(res => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, copy));
                }
                return res;
            }).catch(() => caches.match(req))
        );
        return;
    }

    event.respondWith(
        caches.match(req).then(cached => cached || fetch(req).then(res => {
            if (res && res.ok) {
                const copy = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(req, copy));
            }
            return res;
        }))
    );
});
