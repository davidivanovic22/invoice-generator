/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

/**
 * Makes the app installable and usable offline: the built files are
 * precached, navigations fall back to index.html, and fonts/images are cached
 * as they are used. Network calls to APIs (Claude, NBS rates) are not cached.
 * CRA builds this file with Workbox's InjectManifest.
 */
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// Single-page app: every navigation is served by index.html.
const fileExtension = /\/[^/?]+\.[^/]+$/;
registerRoute(({ request, url }) => {
  if (request.mode !== 'navigate') return false;
  if (url.pathname.startsWith('/_')) return false;
  return !fileExtension.test(url.pathname);
}, createHandlerBoundToURL(`${process.env.PUBLIC_URL}/index.html`));

// Images and fonts from this site (invoice motifs, icons).
registerRoute(
  ({ url, request }) => url.origin === self.location.origin && (request.destination === 'image' || request.destination === 'font'),
  new CacheFirst({ cacheName: 'assets', plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 })] })
);

// Lets the page activate a new version right away ("Update" button).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
