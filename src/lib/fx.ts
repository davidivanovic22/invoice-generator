/**
 * EUR → RSD exchange rate for converting tax amounts. Tries free, keyless
 * public sources, caches the result for a day, and falls back to the
 * long-stable NBS middle rate if the network is unavailable.
 */

const CACHE_KEY = 'studio.fx.eur-rsd';
export const FALLBACK_RSD_PER_EUR = 117.2;

type Cached = { rate: number; fetchedAt: string };

const SOURCES: { url: string; read: (json: unknown) => number | undefined }[] = [
  {
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',
    read: (json) => (json as { eur?: { rsd?: number } }).eur?.rsd
  },
  {
    url: 'https://latest.currency-api.pages.dev/v1/currencies/eur.json',
    read: (json) => (json as { eur?: { rsd?: number } }).eur?.rsd
  },
  {
    url: 'https://open.er-api.com/v6/latest/EUR',
    read: (json) => (json as { rates?: { RSD?: number } }).rates?.RSD
  }
];

const readCache = (): Cached | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
};

/** A plausible EUR/RSD rate: guards against a broken source returning nonsense. */
const plausible = (rate: number | undefined): rate is number => typeof rate === 'number' && rate > 80 && rate < 200;

export const fetchRsdPerEur = async (): Promise<{ rate: number; live: boolean }> => {
  const cached = readCache();
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < 24 * 3600 * 1000 && plausible(cached.rate)) {
    return { rate: cached.rate, live: true };
  }
  for (const source of SOURCES) {
    try {
      const response = await fetch(source.url, { cache: 'no-store' });
      if (!response.ok) continue;
      const rate = source.read(await response.json());
      if (!plausible(rate)) continue;
      const rounded = Math.round(rate * 10000) / 10000;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: rounded, fetchedAt: new Date().toISOString() }));
      } catch {
        // Not cached; fine.
      }
      return { rate: rounded, live: true };
    } catch {
      // Try the next source.
    }
  }
  return { rate: cached && plausible(cached.rate) ? cached.rate : FALLBACK_RSD_PER_EUR, live: false };
};

/** Converts between EUR and RSD with a rate expressed as RSD per 1 EUR. Other currencies return null. */
export const convert = (amount: number, from: string, to: string, rsdPerEur: number): number | null => {
  if (from === to) return amount;
  if (from === 'RSD' && to === 'EUR') return amount / rsdPerEur;
  if (from === 'EUR' && to === 'RSD') return amount * rsdPerEur;
  return null;
};
