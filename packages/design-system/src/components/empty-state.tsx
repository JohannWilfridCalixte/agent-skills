import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  readonly action?: ReactNode;
  readonly description: ReactNode;
  readonly icon?: LucideIcon;
  readonly title: string;
}

export function EmptyState({ action, description, icon: Icon, title }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      {Icon !== undefined && (
        <div className="flex size-12 items-center justify-center rounded-full border bg-panel-raised text-primary">
          <Icon aria-hidden className="size-5" />
        </div>
      )}
      <h2 className="max-w-full text-base font-semibold [overflow-wrap:anywhere]">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
