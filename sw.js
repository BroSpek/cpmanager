// sw.js - Service Worker for Caching App Shell with Automatic Updates

const CACHE_NAME = "captive-portal-manager-cache-v1.0.0"; // Keep your current versioned CACHE_NAME
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
				return self.skipWaiting();
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
				return self.clients.claim();
			})
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
				console.error("Service Worker: Fetch failed or cache open failed.", error);
			})
	);
});
