import type { Fetch } from '@/lib/api-client';

import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';

import { createApiClient } from '@/lib/api-client';
import { createAppRouter } from '@/router';

/** Renders the whole app at `url` (path plus optional `#token=` fragment) over a stubbed fetch. */
export function renderApp(url: string, fetch: Fetch = async () => Promise.resolve(new Response('{}', { status: 404 }))) {
  window.history.replaceState(null, '', url);
  const api = createApiClient({ fetch, getToken: () => sessionStorage.getItem('agentic.token') ?? undefined });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter({ api, history: createMemoryHistory({ initialEntries: [url.split('#')[0] ?? '/'] }), queryClient });
  return render(<RouterProvider router={router} />);
}
