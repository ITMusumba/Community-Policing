// Minimal service worker so browsers offer "Install app". It deliberately caches nothing:
// reports and live data always come from the network. The app's own offline queue lives in IndexedDB.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
