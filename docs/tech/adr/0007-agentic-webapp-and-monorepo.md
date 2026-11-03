# 0007 - Agentic webapp and monorepo layout

**Status:** Accepted
**Date:** 2026-11-03

## Context

Configuring agentic means hand-editing `.agentic.json` / `~/.agentic/config.json` against markdown tables, or running the `/agentic-configure` wizard inside an agent. Install and update are four different commands per harness. The repo root is also the plugin root: manifests, `skills/`, `docs/` and `scripts/vendor-skills.mjs` are consumed by Claude, Codex, Cursor and the skills CLI.

## Decision

- A local webapp for one developer (no accounts, no auth), plus an `agentic` CLI that is a pure client of the same local API. No hosted or desktop-shell variant.
- v1 scope: edit global and project config, effective merged view with value origin, model pickers fed by the harness CLIs, install/update/status per harness, read-only browse of work items, vendored-skills management (only where the project has `vendor.json`).
- Out of scope: running workflows or skills from the UI, editing skill contents, work-item actions, multi-user or hosted use, replacing `/agentic-configure`.
- The repo becomes a turborepo monorepo by adding workspaces only: the webapp lives in `applications/agentic`, shared code in `packages/*`. Manifests, `skills/`, `docs/`, `scripts/vendor-skills.mjs` stay at the repo root.

## Rationale

Smallest version that does the core job without hand-editing JSON. Moving skills would break every plugin manifest and install path.

## Consequences

- Plugin install paths are unchanged. A root `package.json`/`turbo.json` coexists with the plugin files.
- Scope is wider than minimal (browse, vendoring); both are read-mostly and gated.

## History

| Date | Change |
|---|---|
| 2026-11-03 | Created |
