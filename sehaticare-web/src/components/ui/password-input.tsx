import * as React from 'react';
import { cn } from '../../lib/utils';
import { Input, type InputProps } from './input';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  visibilityLabel?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { className, disabled, visibilityLabel = 'kata sandi', ...props },
    ref
  ) {
    const [visible, setVisible] = React.useState(false);
    const actionLabel = `${visible ? 'Sembunyikan' : 'Tampilkan'} ${visibilityLabel}`;

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={cn('pr-12', className)}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={actionLabel}
          aria-pressed={visible}
          title={actionLabel}
        >
          {visible ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 4.2A10.6 10.6 0 0 1 12 4c5.5 0 9 5 9 8a10.7 10.7 0 0 1-2 3.4" />
              <path d="M6.6 6.6C4.3 8 3 10.2 3 12c0 3 3.5 8 9 8a10.3 10.3 0 0 0 4.2-.9" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    );
  }
);
