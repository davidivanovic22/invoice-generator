import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { getApiKey, onApiKeyChange, setApiKey, testApiKey } from './client';
import { t } from '../../i18n';

type AiContextValue = { hasKey: boolean; openSettings: () => void };
const AiContext = createContext<AiContextValue | null>(null);

export const useAi = () => {
  const value = useContext(AiContext);
  if (!value) throw new Error('useAi must be used inside <AiProvider>');
  return value;
};

const mask = (key: string) => (key.length > 12 ? `${key.slice(0, 7)}…${key.slice(-4)}` : '••••');

const AiSettingsDialog = ({ onClose }: { onClose: () => void }) => {
  const current = getApiKey();
  const [draft, setDraft] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setTesting(true);
    setError('');
    try {
      await testApiKey(draft);
      setApiKey(draft);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('The key could not be verified.'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="ai-settings-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
            <Icon name="sparkle" className="h-5 w-5" />
          </span>
          <div>
            <h2 id="ai-settings-title" className="text-lg font-semibold text-slate-900">
              {t('Connect Claude AI')}
            </h2>
            <p className="text-sm text-slate-500">{t('Powers the ATS analysis, rewriting and resume import.')}</p>
          </div>
        </div>

        <ol className="mt-5 space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">1</span>
            <span>
              {t('Open')}{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                console.anthropic.com
              </a>{' '}
              {t('and sign in (or create a free account).')}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">2</span>
            <span>{t('Click "Create Key", copy it, and paste it below. You pay Anthropic directly; a full resume optimisation costs a few cents.')}</span>
          </li>
        </ol>

        <div className="mt-5">
          <TextField
            label={t('Anthropic API key')}
            type="password"
            autoComplete="off"
            value={draft}
            onChange={setDraft}
            placeholder={current ? t('Saved: {key}', { key: mask(current) }) : 'sk-ant-…'}
            error={error || undefined}
            hint={t('Stored only in this browser and sent only to Anthropic. Never share it.')}
            onKeyDown={(event) => event.key === 'Enter' && draft.trim() && save()}
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {current ? (
            <Button
              variant="danger"
              onClick={() => {
                setApiKey('');
                onClose();
              }}
            >
              {t('Remove key')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button onClick={onClose}>{t('Cancel')}</Button>
            <Button variant="accent" onClick={save} disabled={!draft.trim() || testing}>
              {testing ? t('Checking…') : t('Connect')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AiProvider = ({ children }: { children: ReactNode }) => {
  const [hasKey, setHasKey] = useState(() => Boolean(getApiKey()));
  const [open, setOpen] = useState(false);
  useEffect(() => onApiKeyChange(() => setHasKey(Boolean(getApiKey()))), []);
  const openSettings = useCallback(() => setOpen(true), []);
  return (
    <AiContext.Provider value={{ hasKey, openSettings }}>
      {children}
      {open && <AiSettingsDialog onClose={() => setOpen(false)} />}
    </AiContext.Provider>
  );
};
