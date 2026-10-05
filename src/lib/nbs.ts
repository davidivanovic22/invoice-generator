/**
 * Official middle exchange rates of the National Bank of Serbia (NBS), via the
 * free kurs.resenje.org API (CORS enabled). Rates are cached in localStorage;
 * only past dates are cached, because the API answers future dates with the
 * latest rate.
 */
import { todayIso } from './dates';

const CACHE_KEY = 'studio.nbs.rates';
const API = 'https://kurs.resenje.org/api/v1/currencies';

type Cache = Record<string, number>;

const readCache = (): Cache => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Cache;
  } catch {
    return {};
  }
};

const writeCache = (cache: Cache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Rates are fetched again next time.
  }
};

const cacheKey = (currency: string, date: string) => `${currency.toUpperCase()}:${date}`;

/** Every rate fetched this session, including today's (which is not stored). */
const memory = new Map<string, number>();

/** RSD for one unit of the currency on that date, if it is already known. */
export const cachedRate = (currency: string, date: string): number | null => {
  if (currency.toUpperCase() === 'RSD') return 1;
  const key = cacheKey(currency, date);
  return memory.get(key) ?? readCache()[key] ?? null;
};

const inflight = new Map<string, Promise<number | null>>();

/** RSD for one unit of the currency on that date (the last published rate for weekends and holidays). */
export const fetchRate = (currency: string, date: string): Promise<number | null> => {
  const known = cachedRate(currency, date);
  if (known !== null) return Promise.resolve(known);
  const key = cacheKey(currency, date);
  const running = inflight.get(key);
  if (running) return running;
  const request = (async () => {
    try {
      const response = await fetch(`${API}/${currency.toLowerCase()}/rates/${date}`);
      if (!response.ok) return null;
      const body = (await response.json()) as { exchange_middle?: number; parity?: number };
      if (!body.exchange_middle) return null;
      const rate = body.exchange_middle / (body.parity || 1);
      memory.set(key, rate);
      if (date < todayIso()) writeCache({ ...readCache(), [key]: rate });
      return rate;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, request);
  return request;
};

/** Converts between any two currencies through RSD. */
export const convert = (amount: number, from: string, to: string, date: string): number | null => {
  if (from.toUpperCase() === to.toUpperCase()) return amount;
  const fromRate = cachedRate(from, date);
  const toRate = cachedRate(to, date);
  return fromRate && toRate ? (amount * fromRate) / toRate : null;
};

export const fetchRatesFor = (pairs: { currency: string; date: string }[]) =>
  Promise.all(pairs.filter((pair) => pair.currency.toUpperCase() !== 'RSD').map((pair) => fetchRate(pair.currency, pair.date)));
