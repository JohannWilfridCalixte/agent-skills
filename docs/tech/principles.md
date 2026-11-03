# Principles

- The API never executes a raw command string or takes a file path from the client. ([ADR-0013](adr/0013-runs-token-and-path-safety.md))
- Config JSON files stay the source of truth; the webapp's sqlite holds only projects and history. ([ADR-0008](adr/0008-config-files-source-of-truth-and-history.md))
- Modules never import each other; cross-module needs go through `domain-shared` ports. ([ADR-0012](adr/0012-webapp-modules-apps-and-tests.md))
- Manifests, `skills/`, `docs/` and `scripts/vendor-skills.mjs` stay at the repo root. ([ADR-0007](adr/0007-agentic-webapp-and-monorepo.md))
