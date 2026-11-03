import { describe, expect, it } from 'vitest';

import { parseClaudePluginList, parseCodexPluginList, parseGitHead, parseSkillsList } from './parse-status.js';

/** Shape of `claude plugin list --json` (an empty machine prints `[]`). */
const CLAUDE_LIST = JSON.stringify([
  { enabled: true, id: 'other@market', version: '1.0.0' },
  { enabled: true, id: 'agentic@agentic', scope: 'user', version: '0.9.0' },
]);

/** Trimmed from a real `codex plugin list` run. */
const CODEX_LIST = `Marketplace \`openai-bundled\`
/Users/me/.codex/.tmp/bundled-marketplaces/openai-bundled/.agents/plugins/marketplace.json

PLUGIN                               STATUS               VERSION        SOURCE
browser@openai-bundled               installed, enabled   26.1027.30824  /Users/me/plugins/browser
messages@openai-bundled              not installed                       /Users/me/plugins/messages
`;

/** Trimmed from a real `npx skills list -g --json` run. */
const SKILLS_LIST = JSON.stringify([
  { name: 'grill-me', scope: 'global', source: 'mattpocock/skills', status: 'tracked' },
  { name: 'twg', scope: 'global', source: null, status: 'untracked' },
]);

describe('parseClaudePluginList', () => {
  it('is installed with the version when agentic@agentic is listed', () => {
    expect(parseClaudePluginList(CLAUDE_LIST)).toEqual({ state: 'installed', version: '0.9.0' });
  });

  it('is not installed for an empty list', () => {
    expect(parseClaudePluginList('[]\n')).toEqual({ state: 'not_installed' });
  });

  it('reports updateAvailable only when the tool says so', () => {
    expect(parseClaudePluginList(JSON.stringify([{ id: 'agentic@agentic', updateAvailable: true, version: '0.9.0' }]))).toEqual({ state: 'installed', updateAvailable: true, version: '0.9.0' });
    expect(parseClaudePluginList(JSON.stringify([{ id: 'agentic@agentic', updateAvailable: 'yes' }]))).toEqual({ state: 'installed' });
  });

  it('is unknown for output that is not a JSON list', () => {
    expect(parseClaudePluginList('Error: oops')).toMatchObject({ state: 'unknown' });
  });
});

describe('parseCodexPluginList', () => {
  it('is installed with the version from its row', () => {
    expect(parseCodexPluginList(`${CODEX_LIST}agentic@agentic                      installed, enabled   1.2.3          /Users/me/agentic\n`)).toEqual({ state: 'installed', version: '1.2.3' });
  });

  it('is not installed when its row says so', () => {
    expect(parseCodexPluginList(`${CODEX_LIST}agentic@agentic                      not installed                       /Users/me/agentic\n`)).toEqual({ state: 'not_installed' });
  });

  it('is not installed when the table has no agentic row', () => {
    expect(parseCodexPluginList(CODEX_LIST)).toEqual({ state: 'not_installed' });
  });

  it('is unknown without a plugin table', () => {
    expect(parseCodexPluginList('error: unknown command')).toMatchObject({ state: 'unknown' });
  });
});

describe('parseSkillsList', () => {
  it('is installed when a skill comes from the agent-skills source', () => {
    expect(parseSkillsList(JSON.stringify([...JSON.parse(SKILLS_LIST), { name: 'agentic-review', source: 'JohannWilfridCalixte/agent-skills' }]))).toEqual({ state: 'installed' });
  });

  it('is not installed otherwise', () => {
    expect(parseSkillsList(SKILLS_LIST)).toEqual({ state: 'not_installed' });
  });

  it('is unknown for non-JSON output', () => {
    expect(parseSkillsList('Global Skills')).toMatchObject({ state: 'unknown' });
  });
});

describe('parseGitHead', () => {
  it('is installed at the short commit', () => {
    expect(parseGitHead('a1b2c3d\n')).toEqual({ state: 'installed', version: 'a1b2c3d' });
  });

  it('is unknown for anything that is not a commit', () => {
    expect(parseGitHead('fatal: not a git repository')).toMatchObject({ state: 'unknown' });
  });
});
