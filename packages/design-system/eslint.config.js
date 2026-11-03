import { createBase } from '@agentic/tooling-eslint-config/base';
import { designSystemBoundaries } from '@agentic/tooling-eslint-config/boundaries';
import { createReact } from '@agentic/tooling-eslint-config/react';

export default [...(await createBase(import.meta.dirname)), ...(await createReact()), ...designSystemBoundaries()];
