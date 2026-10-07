import * as React from 'react';
import { cn } from '../../lib/utils';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-slate-800 text-white',
  outline: 'border border-slate-300 text-slate-700 bg-white',
  success: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border border-sky-200 bg-sky-50 text-sky-800',
  neutral: 'border border-slate-200 bg-slate-50 text-slate-700'
};

export type BadgeVariant = 'default' | 'outline' | 'success' | 'info' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', variants[variant], className)}
      {...props}
    />
  );
}
