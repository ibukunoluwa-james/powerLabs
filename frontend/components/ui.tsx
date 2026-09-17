import Link from 'next/link';
import type { ReactNode } from 'react';
import { STATUS_LABELS, STATUS_STYLES, type TaskStatus } from '@/lib/types';

/** Small shared presentational pieces, kept in one file to avoid ceremony. */

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
      Overdue
    </span>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <span
        aria-hidden
        className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorNotice({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4">
      <p className="font-medium text-rose-900">{title}</p>
      <p className="mt-1 text-sm text-rose-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
      <p className="text-base font-medium text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export const buttonStyles = {
  primary: `${buttonBase} bg-slate-900 text-white hover:bg-slate-700 focus-visible:outline-slate-900`,
  secondary: `${buttonBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-400`,
  danger: `${buttonBase} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 focus-visible:outline-rose-600`,
} as const;

export function ButtonLink({
  href,
  variant = 'secondary',
  children,
}: {
  href: string;
  variant?: keyof typeof buttonStyles;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonStyles[variant]}>
      {children}
    </Link>
  );
}
