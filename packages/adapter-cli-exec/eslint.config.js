import { createBase } from '@agentic/tooling-eslint-config/base';
import { adapterBoundaries } from '@agentic/tooling-eslint-config/boundaries';

export default [...(await createBase(import.meta.dirname)), ...adapterBoundaries('adapter-cli-exec')];
