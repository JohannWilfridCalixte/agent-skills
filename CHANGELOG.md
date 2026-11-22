# Changelog

## Unreleased

### Breaking

- `agentic-implement` needs a `verify` command in `.agentic.json`: the baseline and every check run through `agentic.ts gate`. `step implement` refuses without a green baseline in the run, plus a `survey` note when a hub is set.

### Added

- Helper commands: `put` (work-item files from any worktree), `gate` (runs `verify`, logs `checks`), `merge` (squash-merge only with a clean review of the PR head, mergeable PR and CI proof; `local-ci` marker contract when Actions never started).
- `hook subagent-stop` (Claude Code, shipped in `hooks/claude.json`): a subagent that stops without loading a skill its brief named is sent back once.
- `hook spawn` on Claude Code also checks the `Agent` tool's model, effort and `Load skills:` against the `started` event.
- Run model: playbook steps attach with `--workflow`, child runs, cwd-based work-item activation, unconfirmed decisions, compaction card, automatic quiet hub sync after milestones.
- Step keys `write`, `plan`; an unknown step key exits 1.
- Sessions: in the Claude desktop app, long steps (`implement`, `review.*`, `plan`, `write`, `tickets`) run as separate app sessions (`mcp__ccd_session__start_session`), reporting through `put reports/{agent}.md`; else subagents as before. `hook spawn` checks session starts like `Agent` spawns (`hooks/claude.json` matcher widened). `hook subagent-stop` does not cover sessions.
- Skill `agentic-claude-agents-manager` (Claude desktop app only): runs units as app sessions, relays their questions, watches them, orders merges.
- Helper `manager` commands (ledger `{output}/_manager/`; usage: `agentic.ts` with no args).
- `hook ask` (Claude Code only, PreToolUse `AskUserQuestion`, shipped in `hooks/claude.json`): a relayed manager unit must end its turn with its question block.
- Step keys `unit`, `unit.sidequest` (`unit.<playbook>` falls back to `unit`); limits `manager.parallel` 4, `manager.heartbeat` 15, `manager.usage` 80.

### Changed

- `hook spawn`: a brief carrying `Manager unit: <id>` must match the `manager brief` output (ledger model and effort; fails closed); from the manager's cwd a `start_session` needs that line or `Manager unit: none`.
- `merge --head <sha>`: refuses another PR head; required from a relayed unit's checkout and when the manager ledger is unreadable.
- `hook spawn`: a `Manager unit: <id>` brief is denied unless the unit is `queued`.
- Manager: `stuck <id>` attention line for every unit not closed whose dep, or paused unit whose sidequest, closed without merge; `unit set --deps` only drops deps; `--state paused --paused-by` drops closed entries, keeps open ones; branch fallback matches only the app's 6-hex suffix; relay protocol steers turn ends onto a status.
- `hook compact`: the manager's cwd gets `manager status`, a relayed unit gets its relay block.

## 4.0.0 - 2026-11-08

### Breaking

- bun required for the helper CLI and hooks. Skills stay readable without it.
- Cross-harness steps removed: step-entry `harness`, `limits.crossHarness.timeout`, delegation "Cross-harness" section. [ADR-0006](docs/tech/adr/0006-cross-harness-steps.md) deprecated. Migrate: delete `harness` from step entries and `limits.crossHarness` from `.agentic.json`.

### Added

- Helper CLI `skills/core/agentic-use-workflow/scripts/agentic.ts`, with tests (`bun test`) and CI (`.github/workflows/ci.yml`).
- Hooks shipped by the Claude, Codex and Cursor plugins (`hooks/<harness>.json`): `hook spawn` gate, `hook compact` resume. Manual wiring for skills-CLI installs in the README.
- `references/brief-template.md`.
- `.agentic/review-gates.json` gates (`alwaysOn`, `conditional`, `onDemand`, `security`); `reviewers` is the fallback.
- Optional GitHub hub (`hub sync`, needs `gh`).
- Docs: Review gates, Helper CLI, Hooks sections in `docs/configuration.md`.
- [ADR-0007](docs/tech/adr/0007-helper-cli.md).

### Changed

- `agentic-use-workflow`: steps, models, events and state go through the helper; retry before escalating. Model tiers: tickets `code / medium`, `review.agentic-review-secrets` `frontier / high`, 1M-context step models rejected.
- `agentic-use-knowledge`: layout override, ADR number picked at write time.
