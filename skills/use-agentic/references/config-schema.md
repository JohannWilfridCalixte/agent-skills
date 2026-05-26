# Config Schema Reference

## Full Example

```json
{
  "namespace": "agentic",
  "version": "0.2.0-beta.3",
  "lastUpdate": "2026-05-05T19:57:28.130Z",
  "workflows": ["technical-planning", "implement", "debug", "pr-review"],
  "profiles": [
    {
      "name": "typescript",
      "detect": ["tsconfig.json", "*.ts", "*.tsx"],
      "skills": ["agentic:skill:typescript-engineer"]
    },
    {
      "name": "python",
      "detect": ["pyproject.toml", "*.py"],
      "skills": ["agentic:skill:python-engineer"]
    }
  ],
  "selectedProfiles": ["typescript"],
  "ides": {
    "claude": {
      "outputFolder": ".claude/_agentic_output",
      "highThinkingModelName": "opus",
      "codeWritingModelName": "sonnet",
      "qaModelName": "opus"
    },
    "cursor": {
      "outputFolder": ".agents/cursor/_agentic_output",
      "highThinkingModelName": "claude-4.6-opus-high-thinking",
      "codeWritingModelName": "sonnet-4.6-opus-medium-thinking",
      "qaModelName": "claude-4.6-opus-high-thinking"
    },
    "codex": {
      "outputFolder": ".agents/codex/_agentic_output",
      "highThinkingModelName": "gpt-5.5",
      "codeWritingModelName": "gpt-5.3-codex",
      "qaModelName": "gpt-5.5"
    }
  }
}
```

## Root Fields

| Field | Type | Required | Validation | Default |
|-------|------|----------|------------|---------|
| `namespace` | `string` | yes | `/^[a-z][a-z0-9-]{1,29}$/` | `"agentic"` |
| `version` | `string` | no | semver with optional prerelease | - |
| `lastUpdate` | `string` | no | ISO 8601 datetime | - |
| `workflows` | `string[]` | no | each must be a valid workflow name | `[]` |
| `profiles` | `Profile[]` | no | see Profile sub-schema | `[]` |
| `selectedProfiles` | `string[]` | no | each must match a `profiles[].name` | `[]` |
| `ides` | `Record<IdeKey, IdeSettings>` | no | keys must be valid IDE keys | `{}` |

## Profile Sub-Schema

| Field | Type | Required | Validation | Default |
|-------|------|----------|------------|---------|
| `name` | `string` | yes | unique across profiles | - |
| `detect` | `string[]` | no | file globs for auto-detection | `[]` |
| `skills` | `string[]` | yes | fully qualified skill names (`agentic:skill:*`) | - |

## IdeSettings Sub-Schema

| Field | Type | Required | Validation | Default |
|-------|------|----------|------------|---------|
| `outputFolder` | `string` | no | safe name pattern (see below) | `"_agentic_output"` |
| `highThinkingModelName` | `string` | no | model identifier | Opus 4.6 high thinking or GPT 5.5 xhigh or available equivalent high effort thinking frontier model or harness default |
| `codeWritingModelName` | `string` | no | model identifier | Sonnet 4.6 medium thinking or Composer 2.5 thinking or GPT 5.3 codex or harness default |
| `qaModelName` | `string` | no | model identifier | same default as highThinkingModelName |

## IDE Keys

| IDE | Key |
|-----|-----|
| Claude Code | `claude` |
| Cursor | `cursor` |
| Codex | `codex` |

## Safe Name Pattern

For filesystem-safe values (`outputFolder`, `namespace`):

```
/^[a-z0-9][a-z0-9._-]{0,63}$/
```

Lowercase alphanumeric start, then alphanumeric, dots, underscores, or hyphens. Max 64 characters.
