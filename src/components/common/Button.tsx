import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: Variant;
  fullWidth?: boolean;
};

const variantClasses: Record<Variant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300',
  danger: 'bg-red-600 text-white hover:bg-red-700'
};

export const Button = ({
  children,
  variant = 'primary',
  fullWidth = false,
  className = '',
  ...props
}: Props) => {
  return (
    <button
      className={[
        'rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
        variantClasses[variant],
        fullWidth ? 'w-full' : '',
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
};