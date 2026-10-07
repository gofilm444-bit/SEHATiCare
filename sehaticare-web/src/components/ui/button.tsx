import * as React from 'react';
import { cn } from '../../lib/utils';

const baseStyles =
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  default: 'bg-brand text-white hover:bg-brand-dark shadow-sm',
  secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50',
  outline: 'border border-slate-300 text-slate-900 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
  destructive: 'bg-rose-700 text-white hover:bg-rose-800'
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3',
  md: 'min-h-11 px-4',
  lg: 'min-h-12 px-5 text-base'
};

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export function buttonClassName({
  variant = 'default',
  size = 'md',
  className
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(baseStyles, variants[variant], sizes[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'default', size = 'md', type, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
});
