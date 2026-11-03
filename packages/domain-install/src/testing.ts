import type { Command } from '@agentic/domain-shared';

import type { Harness } from './model/harness.js';
import type { HarnessEnvironment } from './ports/harness-environment.js';

import { err, ok } from '@agentic/kernel-result';

import { HARNESS_CLI } from './model/harness.js';

/** Scripted CLI outputs and home folders; anything unscripted is a missing CLI or folder. Records CLI calls. */
export class FakeHarnessEnvironment implements HarnessEnvironment {
  readonly calls: { readonly args: readonly string[]; readonly harness: Harness }[] = [];
  /** Every `exec` command, in order. */
  readonly executed: Command[] = [];
  private readonly commandOutputs = new Map<string, string>();
  private readonly folders = new Set<string>();
  private readonly outputs = new Map<string, string>();

  cli(harness: Harness, args: readonly string[], stdout: string) {
    this.outputs.set(JSON.stringify([harness, ...args]), stdout);
    return this;
  }

  /** Scripts the stdout of one exact `exec` command (cli, args and cwd). */
  command(command: Command, stdout: string) {
    this.commandOutputs.set(commandKey(command), stdout);
    return this;
  }

  exec(command: Command) {
    this.executed.push(command);
    const stdout = this.commandOutputs.get(commandKey(command));
    return Promise.resolve(stdout === undefined ? err({ reason: `${command.cli} CLI not found` }) : ok(stdout));
  }

  folder(name: string) {
    this.folders.add(name);
    return this;
  }

  homeFolderExists(name: string) {
    return Promise.resolve(this.folders.has(name));
  }

  run(harness: Harness, args: readonly string[]) {
    this.calls.push({ args, harness });
    const stdout = this.outputs.get(JSON.stringify([harness, ...args]));
    return Promise.resolve(stdout === undefined ? err({ reason: `${HARNESS_CLI[harness]} CLI not found` }) : ok(stdout));
  }
}

const commandKey = ({ args, cli, cwd }: Command) => JSON.stringify([cli, cwd ?? null, ...args]);
