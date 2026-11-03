import { createBase } from '@agentic/tooling-eslint-config/base';
import { contractBoundaries } from '@agentic/tooling-eslint-config/boundaries';

export default [...(await createBase(import.meta.dirname)), ...contractBoundaries('contract-http')];
