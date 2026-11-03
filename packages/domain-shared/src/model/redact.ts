const REDACTED = '[REDACTED]';
const SECRET_FLAG = /^--?[\w-]*(token|secret|password|passwd|api[-_]?key|auth)[\w-]*$/i;
const SECRET_ASSIGNMENT = /^(--?[\w-]*(token|secret|password|passwd|api[-_]?key|auth)[\w-]*=).+$/i;
const SECRET_VALUE = /^(gh[pousr]_\w{20,}|sk-[\w-]{20,}|xox[abprs]-[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9+/_-]{40,}={0,2})$/;
const URL_CREDENTIALS = /(\w+:\/\/)[^/@\s]+@/g;

/** Args safe to log: secret-looking values, values after secret flags and URL credentials are replaced. */
export function redactArgs(args: readonly string[]) {
  return args.map((arg, index) => {
    if (index > 0 && SECRET_FLAG.test(args[index - 1] ?? '')) return REDACTED;
    if (SECRET_VALUE.test(arg)) return REDACTED;
    const assignment = SECRET_ASSIGNMENT.exec(arg);
    if (assignment) return `${assignment[1] ?? ''}${REDACTED}`;
    return arg.replaceAll(URL_CREDENTIALS, `$1${REDACTED}@`);
  });
}
