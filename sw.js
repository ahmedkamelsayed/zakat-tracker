// ─── Service Worker ───────────────────────────────────────────

const CACHE_NAME = 'zakat-cache-v1';

const STATIC_ASSETS = [
  'dashboard.html',
  'index.html',
  'money.html',
  'stocks.html',
  'fitr.html',
  'info.html',
  'css/style.css',
  'js/hijri.js',
  'js/api.js',
  'js/store.js',
  'js/ui.js',
  'js/debts.js',
  'js/payments.js',
  'js/gold.js',
  'js/money.js',
  'js/stocks.js',
  'js/fitr.js',
  'js/dashboard.js',
  'js/backup.js',
  'js/notifications.js',
  'js/profiles.js',
  'favicon.svg',
  'manifest.json'
];

const API_HOSTS = ['metals.live', 'er-api.com'];

// ─── Install: cache static assets ────────────────────────────

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// ─── Activate: clean old caches ──────────────────────────────

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.filter(function (name) {
          return name !== CACHE_NAME;
        }).map(function (name) {
          return caches.delete(name);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ─── Fetch: cache-first for local, network-first for API ─────

function isApiRequest(url) {
  for (var i = 0; i < API_HOSTS.length; i++) {
    if (url.hostname.indexOf(API_HOSTS[i]) !== -1) {
      return true;
    }
  }
  return false;
}

self.addEventListener('fetch', function (event) {
  var requestUrl = new URL(event.request.url);

  // Network-first for API calls
  if (isApiRequest(requestUrl)) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        // Cache the fresh API response
        if (response && response.status === 200) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function () {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first for local assets
  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(function (cachedResponse) {
        return cachedResponse || fetch(event.request).then(function (response) {
          if (response && response.status === 200) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: just fetch
  event.respondWith(fetch(event.request));
});
