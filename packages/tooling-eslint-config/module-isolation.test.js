import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';

import { moduleIsolation } from './module-isolation.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });
const tasksFile = '/repo/applications/server/src/modules/tasks/actions/graduate.ts';

ruleTester.run('module-isolation', moduleIsolation, {
  invalid: [
    { code: "import { x } from '../../messages/routes.js';", errors: [{ messageId: 'crossModule' }], filename: tasksFile },
    { code: "export * from '../../actions/module.js';", errors: [{ messageId: 'crossModule' }], filename: tasksFile },
    { code: "await import('../../agents/module.js');", errors: [{ messageId: 'crossModule' }], filename: tasksFile },
    { code: "import { x } from '@agentic/domain-messages';", errors: [{ messageId: 'crossModule' }], filename: tasksFile },
    { code: "import { x } from '@agentic/contract-http/messages';", errors: [{ messageId: 'crossModule' }], filename: tasksFile },
  ],
  valid: [
    { code: "import { x } from '../db/repositories.js';", filename: tasksFile },
    { code: "import { x } from './jira.js';", filename: tasksFile },
    { code: "import { x } from '../../../platform/problem.js';", filename: tasksFile },
    { code: "import { x } from '../../registry.js';", filename: tasksFile },
    { code: "import { x } from '@agentic/domain-tasks';", filename: tasksFile },
    { code: "import { x } from '@agentic/domain-shared/testing';", filename: tasksFile },
    { code: "import { x } from '@agentic/contract-http/tasks';", filename: tasksFile },
    { code: "import { x } from '@agentic/contract-http/problem';", filename: tasksFile },
    { code: "import { x } from './modules/tasks/module.js';", filename: '/repo/applications/server/src/composition-root.ts' },
  ],
});
