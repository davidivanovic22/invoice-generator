/**
 * Registers the service worker in production builds served over HTTPS (or
 * localhost). When a new version has been downloaded, `onUpdate` is called
 * with a function that switches to it.
 */
export const registerServiceWorker = (onUpdate?: (activate: () => void) => void) => {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  const publicUrl = new URL(process.env.PUBLIC_URL || '/', window.location.href);
  if (publicUrl.origin !== window.location.origin) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/service-worker.js`);
      const offer = (worker: ServiceWorker | null) => {
        if (!worker || !navigator.serviceWorker.controller) return;
        onUpdate?.(() => {
          worker.postMessage({ type: 'SKIP_WAITING' });
          navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
        });
      };
      if (registration.waiting) offer(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed') offer(installing);
        });
      });
    } catch {
      // The app works without offline support.
    }
  });
};
