import { createBase } from '@agentic/tooling-eslint-config/base';
import { domainBoundaries } from '@agentic/tooling-eslint-config/boundaries';

export default [...(await createBase(import.meta.dirname)), ...domainBoundaries('domain-runs')];
