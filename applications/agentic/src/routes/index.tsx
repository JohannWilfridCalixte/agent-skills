import { createFileRoute, redirect } from '@tanstack/react-router';

import { readStartProject } from '@/lib/token';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // The fragment was captured in createAppRouter, before routing: Config opens on the start project (AC1).
    const to = readStartProject(globalThis.window) === undefined ? '/projects' : '/config';
    // eslint-disable-next-line ts/only-throw-error -- TanStack Router redirects by throwing
    throw redirect({ to });
  },
});
