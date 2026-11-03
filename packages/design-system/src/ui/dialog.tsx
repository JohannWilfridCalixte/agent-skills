import type { ComponentProps } from 'react';

import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { cn } from '../lib/cn';

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Opens and closes without animation, for a dialog summoned by a key many times a day. */
  readonly instant?: boolean;
  readonly showCloseButton?: boolean;
}

const OVERLAY_MOTION = 'ease-out data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:duration-200 data-[state=open]:fade-in-0';
const CONTENT_MOTION = `${OVERLAY_MOTION} data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95`;

export function Dialog(props: Readonly<ComponentProps<typeof DialogPrimitive.Root>>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export function DialogClose(props: Readonly<ComponentProps<typeof DialogPrimitive.Close>>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export function DialogContent({ children, className, instant = false, showCloseButton = true, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay instant={instant} />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 transition-none grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-6 shadow-2xl sm:max-w-lg',
          !instant && CONTENT_MOTION,
          className,
        )}
        data-slot="dialog-content"
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            data-slot="dialog-close"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogDescription({ className, ...props }: Readonly<ComponentProps<typeof DialogPrimitive.Description>>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

export function DialogHeader({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return <div className={cn('flex flex-col gap-2 text-center sm:text-left', className)} data-slot="dialog-header" {...props} />;
}

export function DialogOverlay({ className, instant = false, ...props }: Readonly<ComponentProps<typeof DialogPrimitive.Overlay> & { instant?: boolean }>) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 transition-none bg-black/60 backdrop-blur-[2px]', !instant && OVERLAY_MOTION, className)}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

export function DialogPortal(props: Readonly<ComponentProps<typeof DialogPrimitive.Portal>>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

export function DialogTitle({ className, ...props }: Readonly<ComponentProps<typeof DialogPrimitive.Title>>) {
  return <DialogPrimitive.Title className={cn('text-lg leading-none font-semibold', className)} data-slot="dialog-title" {...props} />;
}

export function DialogTrigger(props: Readonly<ComponentProps<typeof DialogPrimitive.Trigger>>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}
