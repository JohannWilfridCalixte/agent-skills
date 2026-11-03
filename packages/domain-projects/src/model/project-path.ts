/** Absolute POSIX path with trailing slashes dropped (root stays `/`); `undefined` when relative or empty. */
export function normalizeProjectPath(raw: string) {
  if (!raw.startsWith('/')) return undefined;
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}
