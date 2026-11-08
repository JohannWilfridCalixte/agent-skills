# 0006 - Cross-harness steps

**Status:** Deprecated
**Date:** 2026-11-02

## Context

Every step runs inside the harness that started the workflow, so every reviewer shares one vendor's model family. A second vendor on a high-stakes reviewer (`super-review`, security) catches what the first misses. Codex, Claude Code and Cursor all ship a non-interactive CLI (`codex exec`, `claude -p`, `agent -p`).

## Decision

- Optional `harness` field on a step entry: `steps.{own}.{key} = {harness?, model?, effort?}`. Set and ≠ own → the step runs through that harness's CLI; `model` / `effort` are its ids and levels.
- Resolves like `model` (key, then parent), config levels only; absent → own harness, native subagent as before.
- Same delegation brief, absolute SKILL.md paths, no-Skill-tool rule. Any non-interactive step. Background process, cwd = `workspace.path`, brief on stdin, work-item folder writable; codex also gets the worktree's git common dir and network. Progress lines carry the target `harness`; the orchestrator's `started` carries it in `data.harness`.
- `agentic-review` launches cross-harness reviewers in parallel with the others, same report-only contract and output file, checked before the fix loop.
- Failure (CLI missing, not logged in, non-zero exit, `limits.crossHarness.timeout` (600 min), bad output) → `failed` event, one warning, native rerun on the built-in default.
- `agentic-configure` offers it on review steps when several harnesses are detected, validating models against the target's list.

## Rationale

- One optional field reuses resolution, brief and events; no new skill, no scripts.
- Falling back to native keeps a review from blocking on another vendor's outage or login.

## Alternatives Considered

- **Separate `crossHarness` config block**: rejected. Splits a step's settings across two places.
- **Fail the step when the CLI fails**: rejected. A missing second opinion shouldn't stop the review; the warning and `failed` event keep it visible.

## Consequences

- Needs the target CLI installed and logged in on the same machine; cost lands on that vendor's account.
- Claude and Cursor CLIs: writes outside cwd (work-item folder, a worktree's git common dir) depend on their own sandbox settings; Cursor's unverified. A blocked write fails the step into the fallback.
- A child entry inheriting a parent's `harness` must use that harness's model ids.

## History

| Date | Change |
|---|---|
| 2026-11-02 | Created |
| 2026-11-08 | Deprecated in v4.0.0: cross-harness steps removed; every step runs in the session's own harness. See [ADR-0007](0007-helper-cli.md) |
