# Agentic webapp

Local app for one developer to configure and maintain agentic. Started with `agentic serve` (binds 127.0.0.1); an `agentic` CLI is a client of the same API.

## What it does

- Edit global (`~/.agentic/config.json`) and project (`.agentic.json`) config with validation, a diff before save, and only non-default values written. Unknown keys are kept and flagged as possibly stale.
- Effective config view: every value shown with its origin (default, global, project).
- Model and effort pickers fed by the harness CLIs; unknown ids warn, missing CLI falls back to free text.
- Install, update and status per harness and method, with command preview, confirmation, live output.
- History of config writes and install/update runs, with restore (diff, confirm, undoable).
- Read-only browse of a project's active and archived work items.
- Vendored-skills check, verify and update, shown only in a project with `vendor.json`.

## Not included

Running workflows from the UI, editing skills, work-item actions, multi-user or hosted use, replacing `/agentic-configure`, conflict detection on save (last write wins, history keeps the overwritten content).

See [ADR 0007](../tech/adr/0007-agentic-webapp-and-monorepo.md), [0008](../tech/adr/0008-config-files-source-of-truth-and-history.md), [0009](../tech/adr/0009-local-api-command-execution.md), [0010](../tech/adr/0010-work-item-browse-read-only.md).
