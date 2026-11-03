import { describe, expect, it } from 'vitest';

import { parseAgentModels, parseCodexModels } from './parse-models.js';

/** Trimmed from a real `agent models` run. */
const AGENT_MODELS = `Available models

auto - Auto (default)
gpt-5.3-codex - Codex 5.3
claude-opus-5-thinking-high - Claude Opus 5 1M Thinking

Tip: use --model <id> (or /model <id> in interactive mode) to switch. Parameterized models also accept quoted overrides, e.g. --model 'claude-opus-4-8[context=1m,effort=high,fast=false]'.
`;

/** Trimmed from a real `codex debug models` run (one JSON document). */
const CODEX_MODELS = JSON.stringify({
  models: [
    { default_reasoning_level: 'medium', description: 'Latest workhorse model.', display_name: 'GPT-6.1-Sol', slug: 'gpt-6.1-sol' },
    { display_name: 'GPT-6-Astra', slug: 'gpt-6-astra' },
  ],
});

describe('parseAgentModels', () => {
  it('reads the id before " - " on each model line, skipping header and tip', () => {
    expect(parseAgentModels(AGENT_MODELS)).toEqual(['auto', 'gpt-5.3-codex', 'claude-opus-5-thinking-high']);
  });

  it('strips terminal colour codes', () => {
    expect(parseAgentModels('\u001B[1mauto\u001B[0m - Auto (default)\n')).toEqual(['auto']);
  });

  it('returns no ids for unrelated output', () => {
    expect(parseAgentModels('Error: not logged in\n')).toEqual([]);
  });
});

describe('parseCodexModels', () => {
  it('reads each model slug', () => {
    expect(parseCodexModels(CODEX_MODELS)).toEqual(['gpt-6.1-sol', 'gpt-6-astra']);
  });

  it('skips entries without a string slug', () => {
    expect(parseCodexModels('{"models":[{"slug":"a"},{"slug":3},null,{}]}')).toEqual(['a']);
  });

  it('returns no ids for non-JSON or an unexpected shape', () => {
    expect(parseCodexModels('not json')).toEqual([]);
    expect(parseCodexModels('{"items":[]}')).toEqual([]);
  });
});
