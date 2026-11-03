# 0009 - Local API command execution and safety

**Status:** Accepted
**Date:** 2026-11-03

## Context

The local API runs install, update and vendoring commands on the developer's machine. A web page in the user's browser must not be able to drive it.

## Decision

- `agentic serve` binds `127.0.0.1` only and starts API and web together. The CLI is a pure API client: server down gives a clear error telling the user to run `agentic serve`. Port is configurable by flag or env.
- The server builds commands from validated enums (harness, method, scope, skill names matching a pattern). No raw command strings.
- Foreign `Host` / `Origin` are rejected (DNS rebinding, CSRF). A request whose `Sec-Fetch-Site` header is present and is not `same-origin` or `none` is rejected too: browsers omit `Origin` on cross-site no-cors GETs (`<img src>`) but always send Fetch Metadata; non-browser clients send neither.
- A per-run token that `serve` hands to the web app and CLI is required on write endpoints and on every endpoint that launches a subprocess, GETs included (harness detection, install status, model lists). Pure reads that run no command stay tokenless.
- Install/update: preview the exact command, user confirms, run the local CLI, stream output live, record the exit code in history. Nonzero exit is a failure shown with its output; no auto-retry.
- Status: query each tool's own list/status command (claude and codex plugin list, `npx skills list`, git status for the Cursor clone). Show installed / not installed / unknown; update-available only where the tool reports it. On demand with Refresh, not polled.
- Vendoring (only with `vendor.json`): on-demand check and verify with per-skill results; update for selected or all after confirmation, streamed and recorded in history.

## Rationale

Visible, auditable execution; no ambient network calls; no arbitrary command surface.

## Consequences

Install/update depends on other tools' CLIs and can read "unknown" when they change.

## History

| Date | Change |
|---|---|
| 2026-11-03 | Created |
| 2026-11-03 | Token required on subprocess-launching GETs; `Sec-Fetch-Site` gate (review fix-1.1) |
