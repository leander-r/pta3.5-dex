// ============================================================
// PTA Dex Service Worker — network-first + cache fallback
// ============================================================

const CACHE_NAME = 'pta3.5-dex-v1';
const PRECACHE_URLS = ['./', './index.html'];

// ── Install ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Fetch ──────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle GET requests for same-origin
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Never cache Discord webhooks or external API calls
    if (url.href.includes('discord.com') || url.href.includes('pokeapi.co')) return;

    // Network-first for HTML navigation requests
    if (request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request).then(r => r || caches.match('./index.html')))
        );
        return;
    }

    // Cache-first for JS / CSS / images / fonts
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;
            return fetch(request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            });
        })
    );
});
