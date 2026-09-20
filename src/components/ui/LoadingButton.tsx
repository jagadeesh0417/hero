'use client';
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'accent' | 'outline' | 'danger' | 'ghost';
  children: ReactNode;
}

const variantClasses: Record<string, string> = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  outline: 'btn-outline',
  danger: 'bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-all disabled:opacity-50 inline-flex items-center gap-2',
  ghost: 'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2',
};

export default function LoadingButton({
  loading = false,
  loadingText = 'Please wait...',
  variant = 'primary',
  children,
  disabled,
  className = '',
  ...props
}: LoadingButtonProps) {
  const base = variantClasses[variant] || variantClasses.primary;
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`${base} ${className} ${loading ? 'cursor-wait' : ''} ${isDisabled ? 'disabled:opacity-50' : ''}`}
    >
      {loading ? (
        <>
          <svg
            className="w-4 h-4 animate-spin shrink-0"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
