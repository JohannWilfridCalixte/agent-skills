import type { ReactNode } from 'react';

import type { ApiClient } from './api-client';

import { createContext, use } from 'react';

const ApiContext = createContext<ApiClient | undefined>(undefined);

export function ApiProvider({ api, children }: { readonly api: ApiClient; readonly children: ReactNode }) {
  return <ApiContext value={api}>{children}</ApiContext>;
}

/** The api client of the running app; tests provide one over a stubbed fetch. */
export function useApi() {
  const api = use(ApiContext);
  if (api === undefined) throw new Error('useApi must be used inside <ApiProvider>.');
  return api;
}
