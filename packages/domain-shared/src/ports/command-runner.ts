import type { Command, CommandStream } from '../model/command.js';

/**
 * Streams one validated command (refined in T10): lines as they arrive, then a typed result. A nonzero exit
 * is an outcome carrying its code; spawn failures, timeouts and cancels are typed errors.
 */
export interface CommandRunner {
  stream(command: Command): CommandStream;
}
