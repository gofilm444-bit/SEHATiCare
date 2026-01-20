import * as React from 'react';
import { cn } from '../../lib/utils';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-slate-900 text-white',
  outline: 'border border-slate-300 text-slate-700 bg-white',
  success: 'bg-emerald-600 text-white',
  info: 'bg-sky-600 text-white'
};

export type BadgeVariant = 'default' | 'outline' | 'success' | 'info';

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
