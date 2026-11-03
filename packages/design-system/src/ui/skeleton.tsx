import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

export function Skeleton({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return <div className={cn('animate-pulse rounded-md bg-panel-raised', className)} data-slot="skeleton" {...props} />;
}
