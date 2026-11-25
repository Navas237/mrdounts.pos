import React from 'react';
import { cn } from '@/utils/cn';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-bold rounded-2xl transition-all select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] touch-target focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30';

    const variants = {
      primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-xs hover:shadow-md',
      secondary: 'bg-surface-2 text-ink hover:bg-surface border border-line',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs',
      outline: 'bg-transparent text-ink border border-line hover:bg-surface-2',
      ghost: 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-2',
    };

    const sizes = {
      sm: 'text-xs py-2 px-3 gap-1.5 min-h-[40px]',
      md: 'text-sm py-2.5 px-4 gap-2 min-h-[48px]',
      lg: 'text-base py-3 px-6 gap-2.5 min-h-[52px]',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

