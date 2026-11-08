# 0007 - Helper CLI and hooks

**Status:** Accepted
**Date:** 2026-11-08

## Context

Workflow bookkeeping was prose the orchestrator followed by hand: events, state, step and model resolution, review eligibility, cleanup checks, spawn gating. Result: drift, skipped events, wrong models.

## Decision

- One bun script, `skills/core/agentic-use-workflow/scripts/agentic.ts`, tested with `bun test`, run in CI by `.github/workflows/ci.yml`.
- Commands: `start`, `event`, `state`, `resume`, `decide`, `step`, `review eligible`, `hub sync`, `cleanup check`, `hook spawn`, `hook compact`.
- Skills call it as `bun {agentic-use-workflow}/scripts/agentic.ts`. The placeholder is that skill's base directory; the script locates itself through `import.meta.dir`.
- Hooks: `scripts/hook.sh` wraps `hook spawn` (gate on subagent spawn) and `hook compact` (re-injects resume context after compaction). All three plugins ship them through per-harness files `hooks/claude.json`, `hooks/codex.json`, `hooks/cursor.json`, each referenced by its manifest's `hooks` field.
- Why per-harness files, not one `hooks/hooks.json`:
  - Each harness needs its own `--harness` flag and plugin-root variable (`${CLAUDE_PLUGIN_ROOT}`, `${PLUGIN_ROOT}`, `${CURSOR_PLUGIN_ROOT}`).
  - Cursor uses another file format and other event names (`subagentStart`, `sessionStart`).
  - Claude Code auto-loads `hooks/hooks.json`.
- `hook.sh` exits 0 with a stderr note when bun is missing: hooks never block.
- `gh` is optional. `hub sync` and the PR check of `cleanup check` skip with a message when `gh` is absent or no hub is set (GitHub only).

## Rationale

- Deterministic code beats prose for counters, merges, globs and event validation, and it can be tested.
- A spawn gate catches briefs written by hand before a wrong model or missing event costs a run.

## Alternatives Considered

- **Keep prose-only**: rejected. The drift is the problem.
- **Node script**: rejected. bun gives TypeScript, a test runner and glob with zero dependencies.

## Consequences

- bun is a hard prerequisite for the helper and hooks (breaking, v4.0.0). Skills stay readable without it.
- Cross-harness steps are removed: [ADR-0006](0006-cross-harness-steps.md) deprecated, every step runs in the session's own harness.
- Skills-CLI installs get no hooks automatically: wire them by hand, see the README.
- Codex plugin hooks need the user's review and trust step (`/hooks`).
- Cursor has no post-compaction event, so `hook compact` runs at every session start there.
- Example reviewer rows in the built-in step table are placeholders that projects override.

## History

| Date | Change |
|---|---|
| 2026-11-08 | Created |
