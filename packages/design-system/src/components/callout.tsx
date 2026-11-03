import type { ReactNode } from 'react';

import { useId } from 'react';

import { cn } from '../lib/cn';

export type CalloutTone = 'error' | 'info' | 'warning';

const TONE_CLASSES = {
  error: 'border-l-danger',
  info: 'border-l-info',
  warning: 'border-l-warning',
} as const satisfies Record<CalloutTone, string>;

/** Errors interrupt (`alert`); info and warnings are advisory (`note`). */
const TONE_ROLES = {
  error: 'alert',
  info: 'note',
  warning: 'note',
} as const satisfies Record<CalloutTone, string>;

interface CalloutProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly title?: string;
  readonly tone?: CalloutTone;
}

export function Callout({ children, className, title, tone = 'info' }: CalloutProps) {
  const titleId = useId();

  return (
    <div
      aria-labelledby={title === undefined ? undefined : titleId}
      className={cn('rounded-xl border border-l-4 bg-card px-5 py-4 text-sm', TONE_CLASSES[tone], className)}
      role={TONE_ROLES[tone]}
    >
      {title !== undefined && (
        <h2 className="mb-1 text-[15px] font-semibold" id={titleId}>
          {title}
        </h2>
      )}
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}
