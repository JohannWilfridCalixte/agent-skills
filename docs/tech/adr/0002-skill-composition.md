# 0002 - Skill composition: vendored craft, agentic wrappers, playbooks

**Status:** Accepted. Partially superseded by [0003](0003-implement-feature-light-mode.md), [0004](0004-security-audit-and-review.md)
**Date:** 2026-11-01
**Supersedes (partially):** [0001](0001-prompt-library-rework.md): skills list, light mode, review lenses, ship-feature orchestration, step keys

## Context

v2 agentic skills re-implemented craft that mature third-party skills already do better and keep current: grilling, ticket slicing, TDD implementation, code review, bug diagnosis, security review. Every lens and interview was ours to maintain. One orchestrator (`agentic-ship-feature`) with a light/full triage was the only entry point; users could not swap a reviewer or a codestyle without editing skills, nor build their own chain.

## Decision

### Composition

Agentic = pure composition. Third-party skills, vendored as verbatim copies, do the craft; agentic skills are thin wrappers beside them (matt's `grill-with-docs` pattern: a skill that delegates to co-located skills and adds only its own details): work item, config, model routing, subagent delegation, gates, knowledge, audit log, loops.

Layout `skills/{core,codestyle,flow,review,playbooks}`:

- **core**: `agentic-use-workflow` (single source of every shared contract: config, delegation, work item, events, decisions, escalation gate, how to reach skills), `agentic-use-knowledge`, `agentic-configure`.
- **codestyle**: moved verbatim.
- **flow**: model-invoked agentic steps, so playbooks can call them: `agentic-grill-me`, `agentic-grill-product|functional|tech`, `agentic-to-spec`, `agentic-to-plan`, `agentic-to-tickets`, `agentic-implement`, `agentic-babysit-pr`, `agentic-cleanup`; plus vendored `grilling`, `to-spec`, `to-tickets`, `implement`, `tdd`, `codebase-design`, `diagnosing-bugs`.
- **review**: `agentic-review` (model-invoked step, owns the finding contract) and reviewer skills: vendored `code-review`, `ub-mode`, `super-review`, `pr-security-review`; `agentic-review-secrets`, `agentic-review-access-control`.
- **playbooks**: user-invoked chains: `agentic-implement-feature` (`choice` `branch` pinned to `new`), `agentic-change-feature` (thin alias of `agentic-implement-feature`, `choice` `branch` pinned to `change`), `agentic-debug`, `agentic-pr-review`.

Plugin manifests (`.claude-plugin`, `.cursor-plugin`, `.codex-plugin`) list every skill folder explicitly; Codex marketplace in `.agents/plugins/marketplace.json`. Root `plugin.json` dropped: Agent Plugins spec discovers only `skills/<name>/`, and Codex lets it override the others (0 nested skills). `npx skills` installs flatten to `<skills-dir>/<name>/`, so relative links stay inside one group folder (resolve the same flat or nested).

### Vendored skills

Root `vendor.json` lists each copy (`source`, `skill`, `into`): `grilling`, `to-spec`, `to-tickets`, `implement`, `tdd`, `codebase-design` (transitive, called by `tdd`), `diagnosing-bugs`, `code-review` (mattpocock/skills), `ub-mode` (unclebob/ub-mode), `super-review`, `pr-security-review` (EricTechPro/super-board). `scripts/vendor-skills.mjs update` fetches them with `npx skills add <source>#<sha> … --copy` at upstream HEAD into `<into>/<skill>/`, plus the upstream `LICENSE` at that commit when the folder has none. Copies stay byte-identical; agentic adds details only in its wrappers.

Root `vendor.lock.json` pins each copy, same schema as `skills-lock.json` and taken from the one `npx` writes: commit SHA (`ref`) + `computedHash`. `check` (read-only, exit 1 when upstream changed a skill) and `verify` (copies match their hash) run on it. Native `npx skills check|update` not used: they apply updates instead of reporting, turn `--copy` copies into symlinks, and see nothing once pinned to a SHA.

Reaching a skill:

- model-invoked → `Call the Skill tool with "<name>"`;
- user-invoked copies (`to-spec`, `to-tickets`, `implement`) → read the co-located `../<name>/SKILL.md` and follow it; subagents receive the absolute path.

Setup that third-party skills expect (issue tracker, board, merge gate) comes from the agentic brief: tracker, paths, report-only scope.

### Review

`reviewers: string[]` in config, one report-only subagent per skill, step key `review.<name>`. Default: `code-review`, `ub-mode`, `pr-security-review`, `super-review`, `agentic-review-secrets`, `agentic-review-access-control` (`pr-security-review` replaced by `claude-security-review` per [0004](0004-security-audit-and-review.md); stays vendored, opt-in). agentic-review owns dedupe, the fix list and the loop through `agentic-implement`.

### Playbooks

Interactive until the last gate, autonomous after, never merge, resumable by slug. `agentic-debug` replaces light mode: `diagnosing-bugs` → `diagnosis.md` → to-plan light branch (T1 failing regression test).

### Config

Added `reviewers`. Step keys `review.<reviewer>`; removed `triage`, `review.fix`, `babysit.fix` (fixes run through `agentic-implement`, key `implement`). Other fields unchanged.

## Rationale

- Craft skills maintained by their authors age better than our rewrites; agentic keeps only what they lack: config, routing, audit, gates, loops.
- Vendoring ships one self-contained plugin: no install step, no install-dir resolution, versions pinned by commit, upstream changes reviewed as a diff.
- Model-invoked flow skills are the only way a user-invoked playbook can chain steps (a user-invoked skill cannot reach another).
- A config list of reviewer names makes reviewers and codestyle swappable without touching skills.

## Alternatives Considered

- **Install third-party skills with `npx skills` as dependencies**: rejected; needs an install step (`/agentic-configure`), install-dir path resolution for user-invoked skills, and unpinned upstream versions.
- **Fork and edit third-party skills**: rejected; edits drift from upstream. Verbatim copies plus wrappers keep the update a re-run.
- **Keep agentic review lenses beside third-party reviewers**: rejected; `spec`, `codestyle`, `tests`, `security` overlap `code-review`, `ub-mode`, `pr-security-review`, `super-review`. Only `secrets` and `access-control` kept, as skills.
- **Keep light mode triage**: rejected; debug and change are explicit playbooks, chosen by the user.
- **Merge `agentic-change-feature` into `agentic-implement-feature`** (to-spec classifies the branch): rejected; an explicit entry point pins `change` instead of a guess. The alias keeps one chain to maintain.

## Consequences

- Updating = `scripts/vendor-skills.mjs check`, then `update`, review the diff, commit. Copies are byte-identical to upstream (`verify` proves it): never hand-edit them; every adjustment lives in an agentic wrapper or brief.
- `verify` re-implements the skills CLI hash; a CLI change to its algorithm breaks it until `update` rewrites the lock and the script follows.
- User-invoked copies are read by relative path, so a wrapper must sit in the same group folder as its copy.
- `super-review` refers to files outside its folder (`../super-board/references/…`, `../super-qa/…`) that are not vendored; `agentic-review/references/super-review.md` maps them to agentic equivalents, nothing more vendored.
- Same-name collision when users also install the upstream skills or plugins; one copy per harness.
- Upstream licences travel with each copy (MIT for mattpocock/skills and super-board; ub-mode has none upstream: kept for private use only, not redistributable).
- `super-review` is wrapped report-only by the same file: board routing, PR comments and merge gate skipped; it writes its report like every reviewer.
- Matt's `implement` runs with its code-review step skipped; `agentic-review` covers it once per change, with every configured reviewer.
- More default reviewers → more subagents per review iteration; tune with `reviewers` and `steps`.
- v2 configs with `review.<lens>`, `review.fix`, `babysit.fix` or `triage` keys no longer apply; rename them to the new keys.

## History

| Date | Change |
|---|---|
| 2026-11-01 | Created |
| 2026-11-01 | Vendored `grill-me` removed: `agentic-grill-me` calls `grilling` directly |
| 2026-11-01 | Partially superseded by [0003](0003-implement-feature-light-mode.md): light mode |
| 2026-11-01 | Partially superseded by [0004](0004-security-audit-and-review.md): default reviewers |
