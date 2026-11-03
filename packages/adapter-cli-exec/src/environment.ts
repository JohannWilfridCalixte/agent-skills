/** Variables a CLI needs (system basics, locale, own config dirs, CA bundles, proxies). Server secrets never pass. */
const INHERITED_NAMES = new Set([
  'ALL_PROXY', 'all_proxy', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'CURL_CA_BUNDLE', 'CURSOR_CONFIG_DIR', 'GIT_SSH_COMMAND', 'HOME',
  'HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'LANG', 'LANGUAGE', 'LOGNAME', 'NO_PROXY', 'no_proxy',
  'NODE_EXTRA_CA_CERTS', 'PATH', 'SHELL', 'SSH_AUTH_SOCK', 'TERM', 'TMPDIR', 'TZ', 'USER',
]);
const INHERITED_PREFIXES = ['LC_', 'SSL_CERT_', 'XDG_'];

/** Allowlisted subset of `source` plus `extra` (extra wins). */
export function sanitiseEnvironment(source: Readonly<Record<string, string | undefined>>, extra: Readonly<Record<string, string>> = {}) {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) {
    if (value !== undefined && (INHERITED_NAMES.has(name) || INHERITED_PREFIXES.some((prefix) => name.startsWith(prefix)))) {
      environment[name] = value;
    }
  }
  return { ...environment, ...extra };
}
