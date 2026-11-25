import React from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'pending' | 'preparing' | 'ready' | 'cancelled' | 'delivered' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  size = 'md',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center gap-1.5 font-bold rounded-full select-none';

  const variants = {
    brand: 'bg-brand-50 text-brand-700 border border-brand-200/60',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200/60',
    preparing: 'bg-blue-50 text-blue-700 border border-blue-200/60',
    ready: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
    cancelled: 'bg-rose-50 text-rose-700 border border-rose-200/60',
    delivered: 'bg-surface-2 text-ink-muted border border-line',
    neutral: 'bg-surface-2 text-ink border border-line',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};


