import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

export function Card({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return (
    <div
      className={cn('flex flex-col gap-4 rounded-xl border bg-card py-5 text-card-foreground', className)}
      data-slot="card"
      {...props}
    />
  );
}

export function CardAction({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return (
    <div
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      data-slot="card-action"
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return <div className={cn('px-5', className)} data-slot="card-content" {...props} />;
}

export function CardDescription({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return <div className={cn('text-sm text-muted-foreground', className)} data-slot="card-description" {...props} />;
}

export function CardFooter({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return <div className={cn('flex items-center px-5', className)} data-slot="card-footer" {...props} />;
}

export function CardHeader({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return (
    <div
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto]',
        className,
      )}
      data-slot="card-header"
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return <div className={cn('leading-none font-semibold', className)} data-slot="card-title" {...props} />;
}
