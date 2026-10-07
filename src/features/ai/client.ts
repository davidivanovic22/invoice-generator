import { t } from '../../i18n';

export const AI_MODEL = 'openai/gpt-latest';
const KEY_STORAGE = 'studio.ai.eden.key';
const API_BASE = 'https://api.edenai.run/v3';
let memoryKey: string | undefined;
const listeners = new Set<() => void>();
export const getApiKey = (): string => {
  if (memoryKey !== undefined) return memoryKey;
  try { return localStorage.getItem(KEY_STORAGE) ?? ''; } catch { return ''; }
};
export const setApiKey = (key: string) => {
  memoryKey = key.trim();
  try {
    localStorage.removeItem('studio.ai.key');
    if (memoryKey) localStorage.setItem(KEY_STORAGE, memoryKey);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* Keep the manually entered key in memory if storage is unavailable. */ }
  listeners.forEach(listener => listener());
};
export const onApiKeyChange = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export type AiErrorKind = 'no-key' | 'auth' | 'rate' | 'overloaded' | 'refusal' | 'network' | 'invalid' | 'other';
export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string) { super(message); }
}
export const toAiError = (error: unknown): AiError => {
  if (error instanceof AiError) return error;
  if (error instanceof Error && error.name === 'AbortError') return new AiError('other', t('Cancelled.'));
  return new AiError('network', t('Could not reach Eden AI. Check your internet connection.'));
};
export const edenRequest = async <T>(path: string, options: RequestInit = {}, key = getApiKey()): Promise<T> => {
  if (!key.trim()) throw new AiError('no-key', t('Connect Eden AI first: add your Eden AI API key.'));
  try {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${key.trim()}`);
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new AiError('auth', t('Your Eden AI API key was rejected. Check it in AI settings.'));
      if (response.status === 402) throw new AiError('auth', t('Your Eden AI account has no credit left. Add credit in Eden AI.'));
      if (response.status === 429) throw new AiError('rate', t('Too many requests right now. Wait a minute and try again.'));
      if (response.status >= 500) throw new AiError('overloaded', t('Eden AI is busy at the moment. Please try again shortly.'));
      throw new AiError('invalid', t('Eden AI could not process this request. Try again with less text.'));
    }
    try { return await response.json() as T; }
    catch { throw new AiError('invalid', t('Eden AI returned an unexpected answer. Please try again.')); }
  } catch (error) { throw toAiError(error); }
};
/** Verify credentials through model discovery, without running a paid inference. */
export const testApiKey = async (key: string): Promise<void> => {
  await edenRequest('/info/ocr/resume_parser', {}, key);
};
