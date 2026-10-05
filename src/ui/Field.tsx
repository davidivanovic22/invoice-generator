import {
  useEffect,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react';

export const inputClass =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 transition hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500';

type FieldShellProps = {
  label?: string;
  hint?: ReactNode;
  error?: string;
  id: string;
  className?: string;
  children: ReactNode;
};

const FieldShell = ({ label, hint, error, id, className = '', children }: FieldShellProps) => (
  <div className={className}>
    {label && (
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
      </label>
    )}
    {children}
    {error ? (
      <p className="mt-1 text-xs text-red-600">{error}</p>
    ) : hint ? (
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    ) : null}
  </div>
);

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label?: string;
  hint?: ReactNode;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  wrapperClassName?: string;
};

export const TextField = ({ label, hint, error, value, onChange, wrapperClassName, className = '', ...rest }: TextFieldProps) => {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} id={id} className={wrapperClassName}>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={`${inputClass} ${error ? 'ring-red-300 focus:ring-red-500' : ''} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
};

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  label?: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  wrapperClassName?: string;
};

export const TextArea = ({ label, hint, value, onChange, wrapperClassName, className = '', rows = 3, ...rest }: TextAreaProps) => {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id} className={wrapperClassName}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} resize-y leading-relaxed ${className}`}
        {...rest}
      />
    </FieldShell>
  );
};

type NumberFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label?: string;
  hint?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  suffix?: string;
  wrapperClassName?: string;
};

/**
 * Keeps the raw text while typing (so "1." or "0,5" aren't eaten), accepts a
 * comma as decimal separator, and clamps to `min` on blur.
 */
export const NumberField = ({
  label,
  hint,
  value,
  onChange,
  min,
  suffix,
  wrapperClassName,
  className = '',
  ...rest
}: NumberFieldProps) => {
  const id = useId();
  const [text, setText] = useState(() => (Number.isFinite(value) ? String(value) : ''));

  useEffect(() => {
    const parsed = Number(text.replace(',', '.'));
    if (parsed !== value) setText(Number.isFinite(value) ? String(value) : '');
    // Only resync when the value changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || !Number.isFinite(parsed)) return;
    onChange(parsed);
  };

  return (
    <FieldShell label={label} hint={hint} id={id} className={wrapperClassName}>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(event) => {
            const next = event.target.value.replace(/[^0-9.,-]/g, '');
            setText(next);
            commit(next);
          }}
          onBlur={() => {
            const parsed = Number(text.replace(',', '.'));
            const safe = !Number.isFinite(parsed) || text.trim() === '' ? 0 : parsed;
            const clamped = min !== undefined ? Math.max(min, safe) : safe;
            setText(String(clamped));
            if (clamped !== value) onChange(clamped);
          }}
          className={`${inputClass} tabular-nums ${suffix ? 'pr-9' : ''} ${className}`}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  );
};

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  label?: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  wrapperClassName?: string;
};

export const SelectField = ({ label, hint, value, onChange, options, wrapperClassName, className = '', ...rest }: SelectFieldProps) => {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id} className={wrapperClassName}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9 ${className}`}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
};
