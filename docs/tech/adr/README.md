# Architecture Decision Records

| Entry | Description |
|-------|-------------|
| [0001-prompt-library-rework](0001-prompt-library-rework.md) | Composable, intent-level skills with per-step model/effort, work-item state and plugin packaging. Partially superseded by 0002 |
| [0002-skill-composition](0002-skill-composition.md) | Vendored third-party skills do the craft, agentic wrappers add the rest: core / codestyle / flow / review / playbooks, configurable reviewers. Partially superseded by 0003, 0004 |
| [0003-implement-feature-light-mode](0003-implement-feature-light-mode.md) | Opt-in light mode in `agentic-implement-feature` and `agentic-change-feature`: to-plan light branch checks the feature or change is straightforward, one exchange of blocking questions, fallback to full on the user's yes |
| [0004-security-audit-and-review](0004-security-audit-and-review.md) | `claude-security-review` (single-file vendored prompt) replaces `pr-security-review` as default reviewer; `agentic-security-audit` playbook logs confirmed findings as parent + children, with a disclosure guard |
| [0005-ponytail-in-grills](0005-ponytail-in-grills.md) | Vendored `ponytail` loaded at ultra by `agentic-grill-tech` only, off at handoff; lean-recommendation rules in our own words in `agentic-grill-me` for every focus |
| [0006-cross-harness-steps](0006-cross-harness-steps.md) | Optional `harness` on a step entry runs it through another harness CLI (`codex exec`, `claude -p`, `agent -p`), mainly for reviewers; falls back to a native subagent on failure |
| [0007-agentic-webapp-and-monorepo](0007-agentic-webapp-and-monorepo.md) | Local webapp + CLI client for configuring agentic, v1 scope, and turborepo layout adding workspaces only (`applications/agentic`, `packages/*`) with plugin files kept at the root |
| [0008-config-files-source-of-truth-and-history](0008-config-files-source-of-truth-and-history.md) | Config JSON files stay the source of truth; sqlite holds projects and append-only history; diff-and-save, last write wins, restore as a new entry |
| [0009-local-api-command-execution](0009-local-api-command-execution.md) | API binds 127.0.0.1, validated-enum commands, Origin/Host check and token, confirm-and-stream install/update, best-effort status, on-demand vendoring |
| [0010-work-item-browse-read-only](0010-work-item-browse-read-only.md) | Read-only browse of active and archived work items per project from the effective `{output}` |
| [0011-webapp-runtime-storage-toolchain](0011-webapp-runtime-storage-toolchain.md) | Bun + bun:sqlite + Kysely Migrator, port and db defaults, clone-only distribution, monorepo root mechanics, TypeScript 6/7 split |
| [0012-webapp-modules-apps-and-tests](0012-webapp-modules-apps-and-tests.md) | `@agentic/*` packages, six module slices, three apps, design-system package, fs ports, four test seams |
| [0013-runs-token-and-path-safety](0013-runs-token-and-path-safety.md) | Streamed runs over SSE, token handoff, install command catalogue, path safety, work-item read limits, logging |
