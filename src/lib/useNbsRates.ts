import { useEffect, useState } from 'react';
import { cachedRate, fetchRatesFor } from './nbs';

/** Fetches the NBS rates that are not known yet and re-renders when they arrive. Returns true while loading. */
export const useNbsRates = (pairs: { currency: string; date: string }[]) => {
  const [, setVersion] = useState(0);
  const missing = pairs.filter((pair) => cachedRate(pair.currency, pair.date) === null);
  const key = Array.from(new Set(missing.map((pair) => `${pair.currency}:${pair.date}`)))
    .sort()
    .join('|');
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const wanted = key.split('|').map((item) => {
      const [currency, date] = item.split(':');
      return { currency, date };
    });
    void fetchRatesFor(wanted).then(() => alive && setVersion((value) => value + 1));
    return () => {
      alive = false;
    };
  }, [key]);
  return key !== '';
};
