import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // eslint-disable-next-line ts/only-throw-error -- TanStack Router redirects by throwing
    throw redirect({ to: '/projects' });
  },
});
