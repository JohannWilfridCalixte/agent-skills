# Changelog

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
