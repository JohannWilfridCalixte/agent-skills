import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';

import type { ApiResult } from './api-error';

import { useQuery } from '@tanstack/react-query';

import { ApiRequestError, describeApiError, unwrap } from './api-error';

/** A query whose failure is already described for `ListState` (message plus next step). */
export function useListQuery<T>(
  queryKey: QueryKey,
  load: (signal: AbortSignal) => Promise<ApiResult<T>>,
  options: Pick<UseQueryOptions<T>, 'refetchInterval' | 'refetchOnReconnect' | 'refetchOnWindowFocus' | 'staleTime'> = {},
) {
  const query = useQuery({ ...options, queryFn: async ({ signal }) => unwrap(await load(signal)), queryKey });
  const failure =
    query.error === null
      ? undefined
      : query.error instanceof ApiRequestError
        ? describeApiError(query.error.apiError)
        : { message: query.error.message, nextStep: 'Reload the page, then retry.' };
  return { failure, query };
}
