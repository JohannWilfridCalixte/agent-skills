/** A command built from validated enums: never a raw shell string. Refined in T8/T10. */
export interface Command {
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly executable: string;
}

export interface CommandOutcome {
  readonly exitCode: number;
  readonly output: string;
}
