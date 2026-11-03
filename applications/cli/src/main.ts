#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { runCli } from './cli.js';

/** Starts the server as a child (the CLI never imports server code); SIGINT/SIGTERM reach it so it cleans up serve.json. */
async function spawn(command: readonly string[]) {
  const child = Bun.spawn([...command], { stdio: ['inherit', 'inherit', 'inherit'] });
  const forward = (signal: NodeJS.Signals) => () => {
    child.kill(signal);
  };
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));
  return child.exited;
}

const exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  fetch: (input, init) => fetch(input, init),
  readFile: (path) => readFile(path, 'utf8'),
  runtime: process.execPath,
  serverEntry: fileURLToPath(new URL('../../server/src/main.ts', import.meta.url)),
  spawn,
  stderr: (text) => process.stderr.write(text),
  stdout: (text) => process.stdout.write(text),
});
process.exitCode = exitCode;
