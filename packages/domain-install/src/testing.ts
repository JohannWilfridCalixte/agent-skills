import type { Harness } from './model/harness.js';
import type { HarnessEnvironment } from './ports/harness-environment.js';

import { err, ok } from '@agentic/kernel-result';

import { HARNESS_CLI } from './model/harness.js';

/** Scripted CLI outputs and home folders; anything unscripted is a missing CLI or folder. Records CLI calls. */
export class FakeHarnessEnvironment implements HarnessEnvironment {
  readonly calls: { readonly args: readonly string[]; readonly harness: Harness }[] = [];
  private readonly folders = new Set<string>();
  private readonly outputs = new Map<string, string>();

  cli(harness: Harness, args: readonly string[], stdout: string) {
    this.outputs.set(JSON.stringify([harness, ...args]), stdout);
    return this;
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
