import type { ServerModule } from './module.js';

export const healthModule: ServerModule = {
  name: 'health',
  registerRoutes(app) {
    app.get('/', (c) => c.json({ status: 'ok' }));
  },
};
