import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ClientOnly, createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { useState } from 'react';

import { readToken } from '@/lib/token';
import { AppShell } from '@/shell/app-shell';
import appCss from '@/styles/app.css?url';

interface RouterContext {
  readonly queryClient: QueryClient;
}

function RootComponent() {
  return (
    <ClientOnly fallback={<p className="p-6 text-muted-foreground">Loading…</p>}>
      <TokenGate />
    </ClientOnly>
  );
}

/** No `dark` class: the theme follows `prefers-color-scheme` through the design-system tokens. */
function RootDocument({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Reads the token createAppRouter already moved from `#token=` into sessionStorage (D28). */
function TokenGate() {
  const [token] = useState(() => readToken(globalThis.window));
  return (
    <AppShell hasToken={token !== undefined}>
      <Outlet />
    </AppShell>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  head: () => ({
    links: [{ href: appCss, rel: 'stylesheet' }],
    meta: [
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { content: 'light dark', name: 'color-scheme' },
      { title: 'agentic' },
    ],
  }),
  shellComponent: RootDocument,
});
