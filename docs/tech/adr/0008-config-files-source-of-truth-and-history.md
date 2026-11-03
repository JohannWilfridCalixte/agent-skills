# 0008 - Config files stay the source of truth; sqlite holds projects and history

**Status:** Accepted
**Date:** 2026-11-03

## Context

Agents read `.agentic.json` and `~/.agentic/config.json` directly. The webapp needs its own state: known projects and a record of what it changed.

## Decision

- The two JSON files are the only source of truth for config. The webapp reads and writes them; nothing is stored only in sqlite.
- sqlite holds known projects (added manually, or registered by `agentic serve` in the cwd; removable; no disk scanning) and an append-only history of config writes and install/update runs.
- Saving is explicit: show a diff against the file on disk, write only values that differ from defaults, keep unknown keys untouched and flag them as possibly stale (`review.fix`, `babysit.fix`).
- Last write wins if the file changed on disk since load; the overwritten content is snapshotted first, so nothing is lost.
- Restore shows a diff, asks for confirmation, and writes the old content as a new history entry; the pre-write content is snapshotted too, so a restore is undoable.
- Schema errors (wrong types, bad harness key, negative limit) block save. An unknown model id only warns; if the harness CLI is missing or fails, the picker degrades to free text.

## Rationale

Files stay minimal and valid for `/agentic-configure` and agents. History makes last-write-wins safe.

## Consequences

An agent editing the file concurrently can be overwritten, recoverable from history. No conflict detection or merge.

## History

| Date | Change |
|---|---|
| 2026-11-03 | Created |
