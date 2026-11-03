import type { PlannedAction } from './install-actions';

import { useMutation, useQuery } from '@tanstack/react-query';

import { useApi } from '@/lib/api-context';
import { ApiRequestError, unwrap } from '@/lib/api-error';
import { InstallPreviewResponse, InstallRunResponse } from '@agentic/contract-http/install';
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

import { describeInstallError } from './install-actions';

interface ConfirmRunDialogProps {
  readonly onClose: () => void;
  readonly onStarted: (runId: string) => void;
  readonly planned: PlannedAction | undefined;
}

/** Previews the exact commands (nothing runs), then starts the run only on an explicit confirm (AC13). */
export function ConfirmRunDialog({ onClose, onStarted, planned }: ConfirmRunDialogProps) {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={planned !== undefined}
    >
      <DialogContent>{planned !== undefined && <ConfirmRunBody onStarted={onStarted} planned={planned} />}</DialogContent>
    </Dialog>
  );
}

function ConfirmRunBody({ onStarted, planned }: { readonly onStarted: (runId: string) => void; readonly planned: PlannedAction }) {
  const api = useApi();
  const preview = useQuery({
    gcTime: 0,
    queryFn: async ({ signal }) => unwrap(await api.post('/install/preview', planned.request, InstallPreviewResponse, { signal })),
    queryKey: ['install-preview', planned.request],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0,
  });
  const start = useMutation({
    mutationFn: async () => api.post('/install/runs', { ...planned.request, confirm: true }, InstallRunResponse),
    onSuccess: (result) => {
      if (result.ok) onStarted(result.value.id);
    },
  });
  const previewFailure = preview.error instanceof ApiRequestError ? describeInstallError(preview.error.apiError) : undefined;
  const startFailure = start.data !== undefined && !start.data.ok ? describeInstallError(start.data.error) : undefined;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{`${planned.label}?`}</DialogTitle>
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
          {preview.data.commands.map((command) => (
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
