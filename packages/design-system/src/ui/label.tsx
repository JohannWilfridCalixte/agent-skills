import type { ComponentProps } from 'react';

import { Label as LabelPrimitive } from 'radix-ui';

import { cn } from '../lib/cn';

export function Label({ className, ...props }: Readonly<ComponentProps<typeof LabelPrimitive.Root>>) {
  return (
    <LabelPrimitive.Root
      className={cn('flex items-center gap-2 text-sm leading-none font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50', className)}
      data-slot="label"
      {...props}
    />
  );
}
