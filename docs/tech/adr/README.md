# Architecture Decision Records

| Entry | Description |
|-------|-------------|
| [0001-prompt-library-rework](0001-prompt-library-rework.md) | Composable, intent-level skills with per-step model/effort, work-item state and plugin packaging. Partially superseded by 0002 |
| [0002-skill-composition](0002-skill-composition.md) | Vendored third-party skills do the craft, agentic wrappers add the rest: core / codestyle / flow / review / playbooks, configurable reviewers. Partially superseded by 0003, 0004 |
| [0003-implement-feature-light-mode](0003-implement-feature-light-mode.md) | Opt-in light mode in `agentic-implement-feature` and `agentic-change-feature`: to-plan light branch checks the feature or change is straightforward, one exchange of blocking questions, fallback to full on the user's yes |
| [0004-security-audit-and-review](0004-security-audit-and-review.md) | `claude-security-review` (single-file vendored prompt) replaces `pr-security-review` as default reviewer; `agentic-security-audit` playbook logs confirmed findings as parent + children, with a disclosure guard |
| [0005-ponytail-in-grills](0005-ponytail-in-grills.md) | Vendored `ponytail` loaded at ultra by `agentic-grill-tech` only, off at handoff; lean-recommendation rules in our own words in `agentic-grill-me` for every focus |
| [0006-cross-harness-steps](0006-cross-harness-steps.md) | Optional `harness` on a step entry runs it through another harness CLI (`codex exec`, `claude -p`, `agent -p`), mainly for reviewers; falls back to a native subagent on failure |
