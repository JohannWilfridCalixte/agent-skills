import type { VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    defaultVariants: { variant: 'default' },
    variants: {
      variant: {
        danger: 'border-danger/35 bg-danger/12 text-danger',
        default: 'border-transparent bg-primary text-primary-foreground',
        info: 'border-info/35 bg-info/12 text-info',
        neutral: 'border-border bg-muted text-muted-foreground',
        outline: 'border-border text-foreground',
        purple: 'border-purple/35 bg-purple/12 text-purple',
        success: 'border-success/35 bg-success/12 text-success',
        teal: 'border-teal/35 bg-teal/12 text-teal',
        warning: 'border-warning/35 bg-warning/12 text-warning',
      },
    },
  },
);

interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  readonly asChild?: boolean;
}

export function Badge({ asChild = false, className, variant, ...props }: BadgeProps) {
  const Component = asChild ? Slot.Root : 'span';

  return <Component className={cn(badgeVariants({ variant }), className)} data-slot="badge" {...props} />;
}
