import { stdoutSink } from './platform/log.js';
import { serve } from './serve.js';

const started = await serve({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  env: process.env,
  logSink: stdoutSink,
  stderr: (text) => process.stderr.write(text),
  stdout: (text) => process.stdout.write(text),
});
if ('exitCode' in started) process.exit(started.exitCode);
