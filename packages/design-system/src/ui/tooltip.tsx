import type { ComponentProps } from 'react';

import { Tooltip as TooltipPrimitive } from 'radix-ui';

import { cn } from '../lib/cn';

export function Tooltip(props: Readonly<ComponentProps<typeof TooltipPrimitive.Root>>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

export function TooltipContent({
  children,
  className,
  sideOffset = 6,
  ...props
}: Readonly<ComponentProps<typeof TooltipPrimitive.Content>>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          'z-50 transition-none w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md border bg-panel-raised px-3 py-1.5 text-xs text-balance text-foreground shadow-xl shadow-black/40 duration-125 ease-out fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:duration-100 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=instant-open]:animate-none',
          className,
        )}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export function TooltipProvider({ delayDuration = 200, ...props }: Readonly<ComponentProps<typeof TooltipPrimitive.Provider>>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />;
}

export function TooltipTrigger(props: Readonly<ComponentProps<typeof TooltipPrimitive.Trigger>>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}
