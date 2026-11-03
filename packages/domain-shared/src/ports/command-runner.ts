import type { Command, CommandOutcome } from '../model/command.js';

/** Runs one validated command. Refined in T8. */
export interface CommandRunner {
  run(command: Command): Promise<CommandOutcome>;
}
