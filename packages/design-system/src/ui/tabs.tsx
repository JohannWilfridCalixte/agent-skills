import type { ComponentProps } from 'react';

import { Tabs as TabsPrimitive } from 'radix-ui';

import { cn } from '../lib/cn';

export function Tabs({ className, ...props }: Readonly<ComponentProps<typeof TabsPrimitive.Root>>) {
  return <TabsPrimitive.Root className={cn('flex flex-col gap-3', className)} data-slot="tabs" {...props} />;
}

export function TabsContent({ className, ...props }: Readonly<ComponentProps<typeof TabsPrimitive.Content>>) {
  return <TabsPrimitive.Content className={cn('flex-1 outline-none', className)} data-slot="tabs-content" {...props} />;
}

export function TabsList({ className, ...props }: Readonly<ComponentProps<typeof TabsPrimitive.List>>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-9 w-fit items-center justify-center rounded-lg border bg-card p-[3px] text-muted-foreground',
        className,
      )}
      data-slot="tabs-list"
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: Readonly<ComponentProps<typeof TabsPrimitive.Trigger>>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-border data-[state=active]:bg-panel-raised data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}
