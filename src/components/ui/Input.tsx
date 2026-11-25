import React from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftAddon, rightAddon, id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-right">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-ink">
            {label}
          </label>
        )}

        <div
          className={cn(
            'relative flex items-center rounded-2xl border bg-surface transition-all overflow-hidden focus-within:ring-2 focus-within:ring-brand-500/20',
            error
              ? 'border-rose-300 focus-within:border-rose-500'
              : 'border-line focus-within:border-brand-600'
          )}
        >
          {rightAddon && (
            <div className="pr-3 text-ink-muted flex items-center pointer-events-none select-none">
              {rightAddon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full py-3 px-3 text-sm bg-transparent text-ink placeholder:text-ink-muted/50 focus:outline-none touch-target',
              className
            )}
            {...props}
          />

          {leftAddon && (
            <div className="pl-3 text-ink-muted flex items-center select-none">{leftAddon}</div>
          )}
        </div>

        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        {!error && helperText && <p className="text-xs text-ink-muted">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';


