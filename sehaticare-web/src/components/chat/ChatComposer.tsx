import { memo, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../ui/button';

type ChatComposerProps = {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  showLabel?: boolean;
  maxLength?: number;
  rows?: number;
  errorMessage?: string | null;
  submitLabel?: string;
  disabledLabel?: string;
  onFocusChange?: (focused: boolean) => void;
  leading?: ReactNode;
};

export const ChatComposer = memo(function ChatComposer({
  onSend,
  disabled,
  placeholder,
  label = 'Tulis pesan',
  showLabel = false,
  maxLength = 2000,
  rows = 3,
  errorMessage,
  submitLabel = 'Kirim',
  disabledLabel = 'Mengirim...',
  onFocusChange,
  leading
}: ChatComposerProps) {
  const [text, setText] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await onSend(trimmed);
      setText('');
    } catch {
      // errors handled by parent state
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      <label
        className={showLabel ? 'text-sm font-medium text-slate-800' : 'sr-only'}
        htmlFor="chat-content"
      >
        {label}
      </label>
      <div className="flex w-full items-end gap-2 flex-nowrap">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="flex-1 min-w-0">
          <textarea
            id="chat-content"
            className="min-h-[44px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            rows={rows}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => onFocusChange?.(false)}
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
          />
        </div>
        <Button type="submit" className="shrink-0" disabled={disabled || text.trim().length === 0}>
          {disabled ? disabledLabel : submitLabel}
        </Button>
      </div>
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </form>
  );
});
