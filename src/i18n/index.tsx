import { createContext, Fragment, useContext, useState, type ReactNode } from 'react';
import { SR } from './sr';

/**
 * Tiny i18n: English source strings are the keys, so code stays readable and
 * a missing translation simply falls back to English.
 *
 * Plurals: write the English forms as "one|other"; the Serbian entry has
 * "one|few|many" (1 stavka, 2 stavke, 5 stavki). Pass `count` in vars.
 */

export type Lang = 'sr' | 'en';
const STORAGE_KEY = 'studio.lang';

const detect = (): Lang => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'sr' || saved === 'en') return saved;
  } catch {
    // Storage unavailable: fall through to the browser language.
  }
  const languages = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  return languages.some((language) => /^(sr|hr|bs|sh|cnr|me)\b/i.test(language)) ? 'sr' : 'en';
};

let current: Lang = detect();

export const getLang = () => current;
export const hasChosenLanguage = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true;
  }
};

const pluralIndex = (lang: Lang, count: number) => {
  const n = Math.abs(Math.trunc(count));
  if (lang === 'en') return n === 1 ? 0 : 1;
  if (n % 10 === 1 && n % 100 !== 11) return 0;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return 1;
  return 2;
};

export const t = (text: string, vars?: Record<string, string | number>): string => {
  let out = (current === 'sr' && SR[text]) || text;
  if (out.includes('|') && vars && typeof vars.count === 'number') {
    const forms = out.split('|');
    out = forms[Math.min(pluralIndex(out === text ? 'en' : current, vars.count), forms.length - 1)];
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (match: string, key: string) => (key in vars ? String(vars[key]) : match));
  return out;
};

/** Locale for dates and numbers in the app's own UI. */
export const uiLocale = () => (current === 'sr' ? 'sr-Latn-RS' : 'en-US');

type LanguageContextValue = { lang: Lang; setLang: (lang: Lang) => void };
const LanguageContext = createContext<LanguageContextValue>({ lang: current, setLang: () => undefined });

export const useLanguage = () => useContext(LanguageContext);

/** Re-mounts the app when the language changes, so every plain t() call re-renders. */
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(current);
  const setLang = (next: Lang) => {
    current = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Keep it for this session only.
    }
    document.documentElement.lang = next === 'sr' ? 'sr-Latn' : 'en';
    setLangState(next);
  };
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'sr' ? 'sr-Latn' : 'en';
  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </LanguageContext.Provider>
  );
};
