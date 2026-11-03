import type { ApiError, ApiResult } from '@/lib/api-error';

import { useMutation, useQuery } from '@tanstack/react-query';

import { ApiRequestError, unwrap } from '@/lib/api-error';
import {
  Button,
  Callout,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ListState,
} from '@agentic/design-system';

export interface PreviewCommand {
  readonly cwd?: string | undefined;
  readonly display: string;
}

/** A run to confirm: the preview lists its exact commands (nothing runs), `start` posts it with `confirm: true`. */
export interface RunPlan {
  readonly describeError: (error: ApiError) => { readonly message: string; readonly nextStep: string };
  readonly label: string;
  readonly preview: (signal: AbortSignal) => Promise<ApiResult<readonly PreviewCommand[]>>;
  /** Identifies the preview query; the same plan previews once. */
  readonly previewKey: readonly unknown[];
  readonly start: () => Promise<ApiResult<{ readonly id: string }>>;
}

interface ConfirmRunDialogProps {
  readonly onClose: () => void;
  readonly onStarted: (runId: string) => void;
  readonly plan: RunPlan | undefined;
}

/** Previews the exact commands (nothing runs), then starts the run only on an explicit confirm (AC13, AC22). */
export function ConfirmRunDialog({ onClose, onStarted, plan }: ConfirmRunDialogProps) {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={plan !== undefined}
    >
      <DialogContent>{plan !== undefined && <ConfirmRunBody onStarted={onStarted} plan={plan} />}</DialogContent>
    </Dialog>
  );
}

function ConfirmRunBody({ onStarted, plan }: { readonly onStarted: (runId: string) => void; readonly plan: RunPlan }) {
  const preview = useQuery({
    gcTime: 0,
    queryFn: async ({ signal }) => unwrap(await plan.preview(signal)),
    queryKey: ['run-preview', ...plan.previewKey],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0,
  });
  const start = useMutation({
    mutationFn: plan.start,
    onSuccess: (result) => {
      if (result.ok) onStarted(result.value.id);
    },
  });
  const previewFailure = preview.error instanceof ApiRequestError ? plan.describeError(preview.error.apiError) : undefined;
  const startFailure = start.data !== undefined && !start.data.ok ? plan.describeError(start.data.error) : undefined;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{`${plan.label}?`}</DialogTitle>
        <DialogDescription>These commands will run on this machine, in this order, with your user account.</DialogDescription>
      </DialogHeader>
      {preview.isPending && <ListState label="Loading the command preview" status="loading" />}
      {previewFailure !== undefined && (
        <Callout title="Cannot run this action" tone="error">
          {previewFailure.message} {previewFailure.nextStep}
        </Callout>
      )}
      {preview.data !== undefined && (
        <ol aria-label="Commands" className="flex flex-col gap-2">
          {preview.data.map((command) => (
            <li key={command.display}>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                <code>{command.display}</code>
              </pre>
              {command.cwd !== undefined && <p className="mt-1 text-xs text-muted-foreground">{`In ${command.cwd}`}</p>}
            </li>
          ))}
        </ol>
      )}
      {startFailure !== undefined && (
        <Callout title="The run did not start" tone="error">
          {startFailure.message} {startFailure.nextStep}
        </Callout>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button
          disabled={preview.data === undefined || start.isPending}
          onClick={() => {
            start.mutate();
          }}
        >
          Run on this machine
        </Button>
      </DialogFooter>
    </>
  );
}
