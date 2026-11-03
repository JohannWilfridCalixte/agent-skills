import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

export function Table({ className, ...props }: Readonly<ComponentProps<'table'>>) {
  return (
    <div className="relative w-full overflow-x-auto" data-slot="table-container">
      <table className={cn('w-full caption-bottom text-sm', className)} data-slot="table" {...props} />
    </div>
  );
}

export function TableBody({ className, ...props }: Readonly<ComponentProps<'tbody'>>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} data-slot="table-body" {...props} />;
}

export function TableCaption({ className, ...props }: Readonly<ComponentProps<'caption'>>) {
  return <caption className={cn('mt-4 text-sm text-muted-foreground', className)} data-slot="table-caption" {...props} />;
}

export function TableCell({ className, ...props }: Readonly<ComponentProps<'td'>>) {
  return (
    <td className={cn('p-3 align-top [&:has([role=checkbox])]:pr-0', className)} data-slot="table-cell" {...props} />
  );
}

export function TableFooter({ className, ...props }: Readonly<ComponentProps<'tfoot'>>) {
  return (
    <tfoot className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} data-slot="table-footer" {...props} />
  );
}

export function TableHead({ className, ...props }: Readonly<ComponentProps<'th'>>) {
  return (
    <th
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase [&:has([role=checkbox])]:pr-0',
        className,
      )}
      data-slot="table-head"
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: Readonly<ComponentProps<'thead'>>) {
  return <thead className={cn('[&_tr]:border-b', className)} data-slot="table-header" {...props} />;
}

export function TableRow({ className, ...props }: Readonly<ComponentProps<'tr'>>) {
  return (
    <tr
      className={cn('border-b transition-colors hover:bg-card data-[state=selected]:bg-muted', className)}
      data-slot="table-row"
      {...props}
    />
  );
}
