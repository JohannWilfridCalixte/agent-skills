import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

export function Textarea({ className, ...props }: Readonly<ComponentProps<'textarea'>>) {
  return (
    <textarea
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/40',
        className,
      )}
      data-slot="textarea"
      {...props}
    />
  );
}
