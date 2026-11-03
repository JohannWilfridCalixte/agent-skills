import { createBase } from '@agentic/tooling-eslint-config/base';
import { webBoundaries } from '@agentic/tooling-eslint-config/deliveries';
import { createReact } from '@agentic/tooling-eslint-config/react';

export default [
  { ignores: ['src/routeTree.gen.ts'] },
  ...(await createBase(import.meta.dirname)),
  ...(await createReact()),
  ...webBoundaries(),
];
