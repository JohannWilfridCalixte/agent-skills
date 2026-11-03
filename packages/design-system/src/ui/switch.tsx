import type { ComponentProps } from 'react';

import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '../lib/cn';

export function Switch({ className, ...props }: Readonly<ComponentProps<typeof SwitchPrimitive.Root>>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent p-0.5 shadow-xs transition-colors duration-150 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className,
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="pointer-events-none block size-3.5 rounded-full bg-foreground shadow-sm transition-[translate,background-color] duration-150 ease-out data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground"
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}
