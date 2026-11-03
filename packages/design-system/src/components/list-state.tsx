import type { ReactNode } from 'react';

import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Callout } from './callout';
import { EmptyState } from './empty-state';

export type ListStateProps = EmptyListState | ErrorListState | LoadingListState;

interface EmptyListState {
  readonly action?: ReactNode;
  /** The next step: what the user can do to fill the list. */
  readonly description: ReactNode;
  readonly status: 'empty';
  readonly title: string;
}

interface ErrorListState {
  readonly message: string;
  /** The next step: what the user should do about the error. */
  readonly nextStep: ReactNode;
  readonly onRetry?: () => void;
  readonly status: 'error';
  readonly title?: string;
}

interface LoadingListState {
  readonly label?: string;
  readonly status: 'loading';
}

/** The three non-data states every list renders (AC28): loading, empty and error, each with a next step. */
export function ListState(props: ListStateProps) {
  switch (props.status) {
    case 'empty': {
      return <EmptyState action={props.action} description={props.description} title={props.title} />;
    }
    case 'error': {
      return (
        <Callout title={props.title ?? 'Something went wrong'} tone="error">
          <p>{props.message}</p>
          <p className="mt-1">{props.nextStep}</p>
          {props.onRetry !== undefined && (
            <Button className="mt-3" onClick={props.onRetry} size="sm" variant="outline">
              Retry
            </Button>
          )}
        </Callout>
      );
    }
    case 'loading': {
      return (
        <div aria-busy="true" className="flex flex-col gap-2" role="status">
          <span className="sr-only">{props.label ?? 'Loading'}</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      );
    }
    default: {
      return props satisfies never;
    }
  }
}
