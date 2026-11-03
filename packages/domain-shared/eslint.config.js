import { createBase } from '@agentic/tooling-eslint-config/base';
import { sharedDomainBoundaries } from '@agentic/tooling-eslint-config/boundaries';

export default [...(await createBase(import.meta.dirname)), ...sharedDomainBoundaries()];
