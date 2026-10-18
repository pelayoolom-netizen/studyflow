// StudyFlow Service Worker — Real Web Push & Offline Support
const CACHE_NAME = 'studyflow-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first with cache fallback for navigation and static assets
// Excludes Supabase API and auth calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do NOT cache API calls, Supabase endpoints, or POST/PUT/DELETE
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/auth/')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response and same-origin or static asset, clone to cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // Fallback to cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Red no disponible', { status: 503, statusText: 'Offline' });
      })
  );
});

// WEB PUSH LISTENER
self.addEventListener('push', (event) => {
  let data = {
    title: 'StudyFlow — Aviso Académico',
    body: 'Tienes tareas y exámenes pendientes por revisar.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/',
    tag: 'studyflow-reminder'
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    tag: data.tag || 'studyflow-' + Date.now(),
    renotify: true,
    actions: [
      { action: 'open', title: 'Abrir StudyFlow' },
      { action: 'dismiss', title: 'Entendido' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options).then(() => {
      // Also broadcast to active clients
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            payload: data
          });
        });
      });
    })
  );
});

// NOTIFICATION CLICK LISTENER
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
