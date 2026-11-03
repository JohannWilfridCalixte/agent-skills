# 0010 - Work-item browse is read-only

**Status:** Accepted
**Date:** 2026-11-03

## Context

Work items live under the project's `{output}` (default `.agentic/work`), with `state.json`, `events.jsonl` and markdown docs, archived items under `_archive/`.

## Decision

- Per known project, resolve `{output}` from the effective config and list active and `_archive` items with status from `state.json`.
- Detail shows the events timeline and spec, plan, decisions and reviews read-only. No actions (resume, cleanup).
- Missing folder is an empty state; a malformed `state.json` shows the item as unreadable, never a crash.

## Rationale

Visibility without owning workflow state; agents stay the only writers.

## Consequences

The webapp must tolerate files that agents are writing at the same time.

## History

| Date | Change |
|---|---|
| 2026-11-03 | Created |
