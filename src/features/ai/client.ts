import type Anthropic from '@anthropic-ai/sdk';

/**
 * Claude access for a backend-less app: the user brings their own API key,
 * which is stored only in this browser and sent only to api.anthropic.com.
 */

export const AI_MODEL = 'claude-opus-5-5';
const KEY_STORAGE = 'studio.ai.key';

type Listener = () => void;
const listeners = new Set<Listener>();

export const getApiKey = (): string => {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
};

export const setApiKey = (key: string) => {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Private mode: the key lives only for this page view.
  }
  cachedClient = null;
  listeners.forEach((listener) => listener());
};

export const onApiKeyChange = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export type AiErrorKind = 'no-key' | 'auth' | 'rate' | 'overloaded' | 'refusal' | 'network' | 'invalid' | 'other';

export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string) {
    super(message);
  }
}

let cachedClient: { key: string; client: Anthropic } | null = null;
let sdk: typeof import('@anthropic-ai/sdk') | null = null;

export const getClient = async (): Promise<Anthropic> => {
  const key = getApiKey();
  if (!key) throw new AiError('no-key', 'Connect Claude first: add your Anthropic API key.');
  if (cachedClient?.key === key) return cachedClient.client;
  sdk = sdk ?? (await import('@anthropic-ai/sdk'));
  // The key belongs to the person using this browser; it never touches a server of ours.
  const client = new sdk.default({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 });
  cachedClient = { key, client };
  return client;
};

/** Maps SDK errors to messages a non-technical user can act on. */
export const toAiError = (error: unknown): AiError => {
  if (error instanceof AiError) return error;
  const Sdk = sdk?.default;
  if (Sdk) {
    if (error instanceof Sdk.APIUserAbortError) return new AiError('other', 'Cancelled.');
    if (error instanceof Sdk.AuthenticationError || error instanceof Sdk.PermissionDeniedError)
      return new AiError('auth', 'Your Anthropic API key was rejected. Check it in AI settings.');
    if (error instanceof Sdk.RateLimitError) return new AiError('rate', 'Too many requests right now. Wait a minute and try again.');
    if (error instanceof Sdk.InternalServerError) return new AiError('overloaded', 'Claude is busy at the moment. Please try again shortly.');
    if (error instanceof Sdk.BadRequestError) {
      const message = error.message.toLowerCase();
      if (message.includes('credit') || message.includes('billing')) return new AiError('auth', 'Your Anthropic account has no credit left. Add credit in the Anthropic Console.');
      return new AiError('invalid', 'Claude could not process this request. Try again with less text.');
    }
    if (error instanceof Sdk.APIConnectionError) return new AiError('network', 'Could not reach Claude. Check your internet connection.');
    if (error instanceof Sdk.APIError) return new AiError('other', `Claude returned an error (${error.status ?? 'unknown'}). Please try again.`);
  }
  return new AiError('other', error instanceof Error ? error.message : 'Something went wrong with the AI request.');
};

/** Checks a key with a tiny request. */
export const testApiKey = async (key: string): Promise<void> => {
  sdk = sdk ?? (await import('@anthropic-ai/sdk'));
  const client = new sdk.default({ apiKey: key.trim(), dangerouslyAllowBrowser: true, maxRetries: 0 });
  try {
    await client.models.retrieve(AI_MODEL);
  } catch (error) {
    throw toAiError(error);
  }
};
