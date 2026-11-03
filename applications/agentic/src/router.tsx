import type { RouterHistory } from '@tanstack/react-router';

import type { ApiClient } from './lib/api-client';

import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';

import { createApiClient } from './lib/api-client';
import { ApiProvider } from './lib/api-context';
import { createQueryClient } from './lib/query-client';
import { readToken } from './lib/token';
import { routeTree } from './routeTree.gen';

interface AppRouterOptions {
  readonly api: ApiClient;
  readonly history?: RouterHistory;
  readonly queryClient?: ReturnType<typeof createQueryClient>;
}

export function createAppRouter({ api, history, queryClient = createQueryClient() }: AppRouterOptions) {
  return createRouter({
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    ...(history === undefined ? {} : { history }),
    routeTree,
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <ApiProvider api={api}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiProvider>
    ),
  });
}

/** TanStack Start entry. The token is read lazily: the root route moves it from the URL fragment on first render. */
export function getRouter() {
  return createAppRouter({ api: createApiClient({ getToken: () => readToken(globalThis.window) }) });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
