/** Light / dark / follow the system. Stored per browser and applied before the first render. */
export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'studio.theme';
const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export const readTheme = (): ThemeChoice => {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
};

export const applyTheme = (choice: ThemeChoice = readTheme()) => {
  const dark = choice === 'dark' || (choice === 'system' && Boolean(media()?.matches));
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#4f46e5');
};

export const saveTheme = (choice: ThemeChoice) => {
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Applies for this visit only.
  }
  applyTheme(choice);
};

/** Re-applies when the system switches between light and dark. */
export const watchSystemTheme = () => {
  const query = media();
  const onChange = () => readTheme() === 'system' && applyTheme('system');
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
};
