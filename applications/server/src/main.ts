import { randomBytes } from 'node:crypto';

import { compose } from './composition-root.js';
import { stdoutSink } from './platform/log.js';
import { loadSettings } from './settings.js';

const settings = loadSettings(process.env);
// T4 (`serve`) hands this token to the web app and CLI; it is never logged.
const token = randomBytes(32).toString('base64url');
const { app, db, logger } = await compose({ logSink: stdoutSink, settings, token });

const server = Bun.serve({ fetch: app.fetch, hostname: '127.0.0.1', port: settings.port });
logger.info('server_started', { port: settings.port });

const shutdown = () => {
  void server.stop().then(() => db.destroy());
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
