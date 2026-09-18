# Configuration and execution context

## Discovery and errors

Resolve the project root from the host's selected repository, not the shell's incidental directory. Choose the first existing file: `.agentic.json`, `.agentic.config.json`, `.agentic/config.json`, then the user's `~/.agentic/config.json`. Record other present project candidates as shadowed; do not merge them. Missing configuration uses defaults with one concise notice. Invalid JSON, an invalid field, unknown selected profile, or missing required skill reports its source and stops the dependent operation; other independent authorized work may continue.

Detect the host from actual environment/tool metadata: Claude Code → `claude`, Cursor → `cursor`, Codex → `codex`. If unknown, use common defaults and record the host as unknown. Do not guess model or tool support from a product name.

## Fields

| Field | Type and validation | Default |
|---|---|---|
| `namespace` | String matching `^[a-z][a-z0-9-]{1,29}$` | `agentic` |
| `version` | Optional semantic version | absent |
| `lastUpdate` | Optional ISO 8601 timestamp | absent |
| `workflows` | Array of installed workflow names | `[]` |
| `profiles` | Array of profiles, unique names | `[]` |
| `selectedProfiles` | Array of names present in `profiles` | `[]` |
| `ides` | Object keyed by `claude`, `cursor`, `codex` | `{}` |
| `specFolder` | Project-relative durable specification directory; same path rules as output | `docs/specs` |
| `maxWorkers` | Positive integer; bounded by actual native capacity | `3` |
| `issueClosePolicy` | `merge`, `release`, or `manual`; local commits never imply delivery | `merge` |

Profile fields: `name` is a nonempty unique string, `detect` is an array of globs (default `[]`), and `skills` is an array of fully qualified installed skill identifiers. Installation and selection are distinct: resolve each selected skill through the host catalog or its installed `SKILL.md` and verify its references exist.

IDE settings retain `outputFolder`, `highThinkingModelName`, `codeWritingModelName`, and `qaModelName`. The three model-name fields are optional strings. `models` optionally maps `high_thinking`, `code_writing`, `qa`, and `exploration` to `{ "model": "host-supported-id", "effort": "host-supported-effort" }`; either value may be omitted or null to inherit. Structured role settings take precedence over legacy aliases. See [host-adapter.md](host-adapter.md) for fallback behavior.

### Output paths

`outputFolder` defaults to `_agentic_output`. It is a project-relative directory, not a namespace. `.agentic/output`, `.claude/_agentic_output`, and `.agents/codex/_agentic_output` are valid. Reject empty paths, `.`, absolute paths, drive/UNC paths, control characters, backslashes, and empty or `..` path components (including repeated/trailing slashes). Normalize remaining dot components and resolve against the project root. Check the real existing ancestor and any existing destination symlinks: the resolved destination must remain inside the real project root and permitted host write scope. Recheck before creation. Never silently redirect output or weaken sandbox permissions. A user-authorized external artifact store needs its own explicit path/permission configuration, not traversal through this field.

### Profile and skill algorithm

1. Normalize the task's relevant paths to repository-relative POSIX paths. Use declared ticket files, changed files, or files found by focused exploration; do not activate every profile merely because a monorepo contains its language somewhere.
2. Append selected profiles' skills in `selectedProfiles` order and each profile's `skills` order.
3. In configuration profile order, append skills from profiles with at least one `detect` glob matching a relevant path. A match records profile, glob, and matching path. Selected profiles may also carry detection provenance.
4. Append explicit task skills and skills required by the operation's observable applicability. For `.ts`/`.tsx` work this includes `agentic:skill:typescript-engineer`; for Python work it includes `agentic:skill:python-engineer`. Apply code-testing for test work, clean-architecture for non-trivial backend business logic, and write-instrumented-code for instrumentation work. Those semantic predicates come from their owning skill descriptions, not file-name guesses alone.
5. Deduplicate by canonical skill identifier, preserving first occurrence and all selection reasons. An empty profile selection disables none of steps 3–4. Missing required packages are explicit dependency errors, never silently removed.

Globs are case-sensitive, anchored to the repository-relative path, with `*` matching within one segment, `?` one non-separator character, and `**` any number of segments. `**/` also matches zero segments, so `src/**/*.ts` matches `src/app.ts`. A basename-only pattern such as `*.ts` or `tsconfig.json` matches that basename at any depth. No brace expansion, extglobs, or negation is implied. Report unsupported glob syntax instead of interpreting it differently between hosts.

Re-resolve when task scope grows into another language or configuration changes. Preserve the original context and log the new selection reason. A new model does not replace any engineering rule.

## Example

```json
{
  "namespace": "agentic",
  "profiles": [
    {"name": "frontend", "detect": ["src/**/*.ts"], "skills": ["agentic:skill:typescript-engineer"]}
  ],
  "selectedProfiles": [],
  "ides": {
    "codex": {"outputFolder": ".agentic/output"}
  }
}
```

For language/profile resolution of `src/app.ts` (`kind` omitted), select `frontend` by its glob and TypeScript by language applicability. The resulting `technical_skills_prompt` is `["agentic:skill:typescript-engineer"]`, with both reasons retained. `kind: implementation` additionally selects code-testing. Output resolves to `<repo-root>/.agentic/output`. Absent model settings retain the host's inherited/default selection and record that fallback, rather than hardcoding a model name.

## Validation helper interface

Resolve `<helper>` to the absolute `scripts/agentic.mjs` inside the installed use-workflow skill, using the host's skill catalog. The target project need not contain the Agentic source tree. When the helper package is unavailable, report that capability and perform only the configuration resolution that can be verified from this contract; do not claim an executable validation ran.

Run `node <helper> resolve-config <config.json> <task.json>`. The caller owns filesystem discovery and supplies the chosen config. `task.json` supplies `root`, `host`, `paths` (string array), and `role`; optional `kind`, `business_logic`, `skills`, `model`, `effort`, `available_models`, `available_efforts`, `default_model`, `default_effort`, and `capabilities`. `business_logic: true` selects clean-architecture. Kinds `implementation`, `test`, `debug`, and `review-tests` select code-testing; `instrumentation` selects write-instrumented-code. Capability fields are `subagents`, `shared_filesystem`, `source_writes`, `artifact_writes`, `model_selection`, `effort_selection`, `isolated_worktrees`, and `max_workers`. Record unknown values as unknown rather than claiming availability.

The resolved output contains `namespace`, `output_folder`, `spec_folder`, `selected_profiles`, `profile_provenance`, `technical_skills_prompt`, `role`, `model`, `effort`, `fallback_reason`, `host`, `capabilities`, `max_workers`, and `issue_close_policy`. Save it under state `execution_context`; preserve request, source/discovery, and semantic skill-selection provenance alongside it. Supply additional semantic skills through `skills` when the operation's purpose establishes applicability. Helper success does not establish that an unavailable host capability exists or that a generated directory can be written.
