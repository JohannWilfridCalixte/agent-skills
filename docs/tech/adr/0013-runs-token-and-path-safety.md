# 0013 - Runs, token handoff, command catalogue and path safety

**Status:** Accepted
**Date:** 2026-11-03

## Context

ADR 0009 sets the safety posture for commands run by the local API. This ADR fixes the mechanisms.

## Decision

- `adapter-cli-exec` is new (control-tower's buffers until exit): Bun.spawn, `shell:false`, argument arrays, timeout, process-tree kill, line streaming, typed errors, a fake for tests.
- A run is a resource: POST creates it and returns an id; `GET /runs/:id/events` is a Server-Sent Events stream. The run continues and is recorded in history if the client disconnects; the CLI reads the same stream. Output stored up to 256 KB per run (tail kept, truncated flag).
- `serve` generates a random token. The web app gets it from the printed URL fragment (`#token=…&project=<id>`, the project being the folder serve registered, which the UI opens on), keeps both in sessionStorage and sends the token as bearer on every request. The API requires it on writes and on endpoints that launch a subprocess (ADR 0009). `serve` sets umask 077: `~/.agentic` is 0700, the database files 0600. The CLI reads port and token from `~/.agentic/serve.json` (mode 0600, deleted on exit; a stale file is detected by a failed connect).
- Command catalogue (source `JohannWilfridCalixte/agent-skills`): claude = `plugin marketplace add`, `plugin install agentic@agentic`, `plugin marketplace update agentic` then `plugin update agentic@agentic`, status `plugin list --json`; codex = `plugin marketplace add`, `plugin add agentic@agentic`, `plugin marketplace upgrade`, status `plugin list`; cursor = `git clone` into `~/.cursor/plugins/local/agentic` / `git pull`, status `git status`; skills CLI = `npx skills add|update|list`, global by default, project scope when a project is selected.
- Path safety: the API never takes a file path from the client. Config targets are only `~/.agentic/config.json` or `<known project>/.agentic.json`; project paths are validated (absolute, exists, directory). Writes are atomic (temp file + rename), 2-space JSON with trailing newline, file mode kept. Work-item and doc names are slug-validated; `..` is rejected.
- Work-item reads: markdown rendered with a sanitizing renderer, no raw HTML, links with `rel=noopener`; `events.jsonl` capped at the latest 1000 events or 5 MB with a truncated flag, malformed lines skipped and counted; docs capped at 1 MB with a truncated notice.
- Logs: one JSON line per request and per run on stdout with a correlation id header; no OpenTelemetry. No history pruning in v1.

## Rationale

Streaming that survives a closed tab; token never in logs or Referer; no arbitrary file or command surface.

## Consequences

History can grow unbounded (revisit); status depends on other tools' CLIs and may read unknown.

## History

| Date | Change |
|---|---|
| 2026-11-03 | Created |
| 2026-11-03 | Token on subprocess-launching GETs; startup project in the URL fragment; home 0700 and database 0600 (review fix-1.1) |
