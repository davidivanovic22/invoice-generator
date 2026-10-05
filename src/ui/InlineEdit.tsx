import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { Icon } from './Icon';

type Props = {
  value: string;
  onSave: (value: string) => void;
  /** Returns an error message, or undefined when the value is fine. */
  validate?: (value: string) => string | undefined;
  /** What the title shows when not editing; defaults to the value. */
  display?: ReactNode;
  label: string;
  className?: string;
};

/** A title you click to edit in place, with save (✓) and cancel (✕), like a Jira issue title. */
export const InlineEdit = ({ value, onSave, validate, display, label, className = '' }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = draft.trim();
  const error = trimmed ? validate?.(trimmed) : t('This cannot be empty.');

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const start = () => {
    setDraft(value);
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const save = () => {
    if (error) return;
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        title={t('Click to edit')}
        aria-label={`${label}: ${value}. ${t('Click to edit')}`}
        className={`group -mx-1.5 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition hover:bg-slate-100 ${className}`}
      >
        <span className="truncate">{display ?? value}</span>
        <Icon name="pen" className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-slate-500" />
      </button>
    );
  }

  return (
    <div className="relative flex min-w-0 items-center gap-1">
      <input
        ref={inputRef}
        value={draft}
        aria-label={label}
        aria-invalid={Boolean(error)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save();
          if (event.key === 'Escape') {
            event.stopPropagation();
            cancel();
          }
        }}
        className={`h-9 w-40 min-w-0 rounded-lg bg-white px-2.5 text-[15px] font-semibold text-slate-900 outline-none ring-2 sm:w-48 ${
          error ? 'ring-red-400' : 'ring-indigo-500'
        }`}
      />
      <button
        type="button"
        onClick={save}
        disabled={Boolean(error)}
        aria-label={t('Save')}
        title={t('Save')}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40"
      >
        <Icon name="check" className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={cancel}
        aria-label={t('Cancel')}
        title={t('Cancel')}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
      >
        <Icon name="x" className="h-4 w-4" />
      </button>
      {error && <span className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-red-600 px-2 py-1 text-xs text-white shadow">{error}</span>}
    </div>
  );
};
