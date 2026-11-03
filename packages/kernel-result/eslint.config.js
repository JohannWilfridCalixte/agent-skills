import { createBase } from '@agentic/tooling-eslint-config/base';
import { kernelBoundaries } from '@agentic/tooling-eslint-config/boundaries';

export default [...(await createBase(import.meta.dirname)), ...kernelBoundaries('kernel-result')];
