const BOOLEAN_FLAGS = new Set(['all', 'json', 'yes']);

export interface ParsedArgs {
  readonly flags: ReadonlySet<string>;
  readonly options: ReadonlyMap<string, readonly string[]>;
  readonly positionals: readonly string[];
}

/** `--name value`, `--name=value`, boolean `--json --yes --all`; repeated options keep every value; `--` ends options. */
export function parseArgs(argv: readonly string[]) {
  const flags = new Set<string>();
  const options = new Map<string, string[]>();
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';
    if (argument === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!argument.startsWith('--')) {
      positionals.push(argument);
      continue;
    }
    const [name = '', inline] = argument.slice(2).split(/=(.*)/s, 2);
    if (BOOLEAN_FLAGS.has(name)) {
      flags.add(name);
      continue;
    }
    const value = inline ?? argv[index + 1];
    if (value === undefined) return { error: `Missing value for --${name}.`, ok: false } as const;
    if (inline === undefined) index += 1;
    options.set(name, [...(options.get(name) ?? []), value]);
  }
  return { ok: true, value: { flags, options, positionals } satisfies ParsedArgs } as const;
}

export const lastOption = (args: ParsedArgs, name: string) => args.options.get(name)?.at(-1);
