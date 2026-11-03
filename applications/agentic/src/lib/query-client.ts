import { QueryClient } from '@tanstack/react-query';

import { ApiRequestError } from './api-error';

const MAX_NETWORK_RETRIES = 2;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { refetchOnWindowFocus: false, retry: shouldRetry, staleTime: 30_000 },
    },
  });
}

/** Problems (4xx/5xx with a body) are answers, not glitches: only network failures are retried. */
function shouldRetry(failureCount: number, error: Error) {
  if (error instanceof ApiRequestError && error.apiError.type !== 'network') return false;
  return failureCount < MAX_NETWORK_RETRIES;
}
