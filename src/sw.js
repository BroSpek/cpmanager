// sw.js - Service Worker for Caching App Shell with Automatic Updates and Notification Handling

// Increment the version when you change urlsToCache or the SW logic itself.
const CACHE_NAME = "cpm-cache-v0.1.0";
const urlsToCache = [
  "index.html",
  "icons/icon-192x192.png",
  "icons/icon-512x512.png",
  // If you add new files to app shell, add them here AND update CACHE_NAME
];

self.addEventListener("install", (event) => {
  console.log(`Service Worker: Installing ${CACHE_NAME}...`);
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log(`Service Worker: Caching app shell into ${CACHE_NAME}`);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log(
          `Service Worker: App shell for ${CACHE_NAME} cached successfully`,
        );
        return self.skipWaiting(); // Activate new SW immediately
      })
      .catch((error) => {
        console.error(
          `Service Worker: Caching for ${CACHE_NAME} failed`,
          error,
        );
      }),
  );
});

self.addEventListener("activate", (event) => {
  console.log(`Service Worker: Activating ${CACHE_NAME}...`);
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log(`Service Worker: Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        console.log(
          `Service Worker: Activated (${CACHE_NAME}) and old caches cleaned.`,
        );
        return self.clients.claim(); // Take control of uncontrolled clients
      }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).then((networkResponse) => {
            return networkResponse;
          });
        });
      })
      .catch((error) => {
        console.error(
          "Service Worker: Fetch failed or cache open failed.",
          error,
        );
      }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, body, icon, id } = event.data.payload;
    event.waitUntil(
      self.registration.showNotification(title, {
        body: body,
        icon: icon || "icons/icon-192x192.png",
        badge: "icons/badge-icon.png",
        tag: `new-user-signin-${id || new Date().getTime()}`,
      }),
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = new URL("index.html#sessions", self.registration.scope)
    .href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (
            client.url.startsWith(self.registration.scope) &&
            "focus" in client
          ) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
  );
});
