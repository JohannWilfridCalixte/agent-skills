import { createBase } from '@agentic/tooling-eslint-config/base';
import { serverBoundaries } from '@agentic/tooling-eslint-config/deliveries';

export default [...(await createBase(import.meta.dirname)), ...serverBoundaries()];
