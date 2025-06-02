// sw.js - Service Worker for Caching App Shell with Automatic Updates and Notification Handling

// Increment the version when you change urlsToCache or the SW logic itself.
const CACHE_NAME = "captive-portal-manager-cache-v1.0.1"; // << Cache version updated
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
				console.log(`Service Worker: App shell for ${CACHE_NAME} cached successfully`);
				return self.skipWaiting(); // Activate new SW immediately
			})
			.catch((error) => {
				console.error(`Service Worker: Caching for ${CACHE_NAME} failed`, error);
			})
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
					})
				);
			})
			.then(() => {
				console.log(`Service Worker: Activated (${CACHE_NAME}) and old caches cleaned.`);
				return self.clients.claim(); // Take control of uncontrolled clients
			})
	);
});

self.addEventListener("fetch", (event) => {
	// We only care about GET requests for caching
	if (event.request.method !== "GET") {
		return;
	}

	event.respondWith(
		caches
			.open(CACHE_NAME)
			.then((cache) => {
				return cache.match(event.request).then((response) => {
					// If resource is in cache, return it
					if (response) {
						// console.log(`Service Worker: Serving ${event.request.url} from cache.`);
						return response;
					}
					// If resource is not in cache, fetch from network
					// console.log(`Service Worker: Fetching ${event.request.url} from network.`);
					return fetch(event.request).then((networkResponse) => {
						// Optionally, cache dynamically fetched resources if needed,
						// but for app shell, explicit caching during install is usually sufficient.
						return networkResponse;
					});
				});
			})
			.catch((error) => {
				// This catch handles errors from cache.open() or fetch()
				console.error("Service Worker: Fetch failed or cache open failed.", error);
				// You might want to return a fallback page here if appropriate
				// e.g., return caches.match('offline.html');
			})
	);
});

self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SHOW_NOTIFICATION") {
		const { title, body, icon } = event.data.payload;
		event.waitUntil(
			self.registration.showNotification(title, {
				body: body,
				icon: icon || "icons/icon-192x192.png", // Default icon
				badge: "icons/badge-icon.png", // Icon for Android notification bar
				tag: "new-user-signin", // Use a static tag to replace previous general sign-in notifications
				// data: { url: './index.html#sessions' } // Optional: pass data to notificationclick
			})
		);
	}
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close(); // Always close the notification

	// Define the URL to open, navigating to the sessions tab
	// self.location.origin provides the base URL of the service worker's scope
	const urlToOpen = new URL("./index.html#sessions", self.location.origin).href;

	event.waitUntil(
		clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
			// Check if there's already a window/tab open for the app
			for (const client of clientList) {
				// Ensure the client URL is part of your app and it can be focused
				if (client.url.startsWith(self.location.origin) && "focus" in client) {
					// Navigate the existing client to the target URL (with hash)
					client.navigate(urlToOpen);
					return client.focus(); // Focus the existing window
				}
			}
			// If no existing window is found, open a new one
			if (clients.openWindow) {
				return clients.openWindow(urlToOpen);
			}
		})
	);
});
