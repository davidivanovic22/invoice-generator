import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export const Input = ({ label, className = '', ...props }: Props) => {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        className={[
          'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition',
          'focus:border-blue-500 focus:ring-4 focus:ring-blue-100',
          className
        ].join(' ')}
        {...props}
      />
    </label>
  );
};