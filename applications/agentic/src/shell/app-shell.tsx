import type { ReactNode } from 'react';

import { Link } from '@tanstack/react-router';

import { Callout } from '@agentic/design-system';

const NAV_ITEMS = [
  { label: 'Projects', to: '/projects' },
  { label: 'Config', to: '/config' },
  { label: 'Install', to: '/install' },
  { label: 'Work items', to: '/work-items' },
  { label: 'History', to: '/history' },
  { label: 'Vendoring', to: '/vendoring' },
] as const;

interface AppShellProps {
  readonly children: ReactNode;
  readonly hasToken: boolean;
}

export function AppShell({ children, hasToken }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        href="#main"
      >
        Skip to content
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-3">
          <span className="text-base font-semibold">agentic</span>
          <nav aria-label="Main">
            <ul className="flex flex-wrap gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <Link
                    activeProps={{ 'aria-current': 'page', 'className': 'bg-accent text-accent-foreground' }}
                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    to={item.to}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 focus:outline-none" id="main" tabIndex={-1}>
        {!hasToken && (
          <Callout title="No access token" tone="error">
            Open the URL printed by `agentic serve`: it carries the token this page needs to make changes.
          </Callout>
        )}
        {children}
      </main>
    </div>
  );
}
