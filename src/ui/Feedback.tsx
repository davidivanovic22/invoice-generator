import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { onStorageIssue, type StorageIssue } from '../lib/storage';
import { Button } from './Button';
import { Icon } from './Icon';

type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'default';
};

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info'; action?: ToastAction };

type FeedbackContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** An optional action (e.g. Undo) keeps the toast up longer. */
  toast: (message: string, tone?: Toast['tone'], action?: ToastAction) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return context;
};

export const FeedbackProvider = ({ children }: { children: ReactNode }) => {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [storageIssue, setStorageIssue] = useState<StorageIssue | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const nextId = useRef(0);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'success', action?: ToastAction) => {
    const id = ++nextId.current;
    setToasts((current) => [...current.slice(-2), { id, message, tone, action }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), action ? 7000 : 3200);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...options, resolve })),
    []
  );

  useEffect(() => onStorageIssue(setStorageIssue), []);

  useEffect(() => {
    if (!dialog) return;
    confirmButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  const close = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ confirm, toast }}>
      {storageIssue && (
        <div role="alert" className="flex items-start gap-3 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{storageIssue.message}</p>
          <button type="button" onClick={() => setStorageIssue(null)} className="font-medium underline">
            {t('Dismiss')}
          </button>
        </div>
      )}

      {children}

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onMouseDown={() => close(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900">
              {dialog.title}
            </h2>
            {dialog.message && <div className="mt-2 text-sm text-slate-600">{dialog.message}</div>}
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={() => close(false)}>{t('Cancel')}</Button>
              <Button
                ref={confirmButtonRef}
                variant={dialog.tone === 'danger' ? 'primary' : 'accent'}
                className={dialog.tone === 'danger' ? '!bg-red-600 hover:!bg-red-500' : ''}
                onClick={() => close(true)}
              >
                {dialog.confirmLabel ?? t('Confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
              item.tone === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            <Icon name={item.tone === 'error' ? 'alert' : 'check'} className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.message}</span>
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  item.action?.onClick();
                  setToasts((current) => current.filter((other) => other.id !== item.id));
                }}
                className="rounded-md px-2 py-0.5 font-semibold text-indigo-300 hover:bg-white/10 hover:text-white"
              >
                {item.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
};
