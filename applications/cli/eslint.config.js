import { createBase } from '@agentic/tooling-eslint-config/base';
import { cliBoundaries } from '@agentic/tooling-eslint-config/deliveries';

export default [...(await createBase(import.meta.dirname)), ...cliBoundaries()];
