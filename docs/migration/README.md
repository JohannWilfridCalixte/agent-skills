# Skills-only migration

This change applies the accepted September 2026 architecture review, including the proposed next-stage features. The repository owner authorized committing, pushing and opening a pull request on 18 September 2026 after the initial uncommitted handoff. The complete `typescript-engineer` package is protected by eleven recorded SHA-256 hashes, including its manifest and examples.

## Review order

1. [Decisions and acceptance map](decisions.md): policy choices made concrete by the approved recommendations.
2. [Root README](../../README.md): installation, configuration, workflows, and local validation.
3. [Runtime contract](../../skills/use-workflow/references/state-contract.md) and [durable plans](../../skills/use-workflow/references/plan-contract.md): state, revisions, gates, and evidence.
4. [Implementation integration](../../skills/implement/steps/step-02-process-tickets.md), [review contract](../../skills/review-loop/SKILL.md), and [knowledge lifecycle](../../skills/use-knowledge/SKILL.md).
5. [Evaluation campaign](../../tests/evals/README.md): repeatable cases and the limits of local checks.
6. [Recorded verification](verification.md): results, independent review fixes, and what remains for live testing.

The source audit is retained in `.agentic/output/2026-09-11-skills-audit/index.html` as a historical snapshot. It intentionally describes the old library. Local baseline/application results and command outputs are under `.agentic/output/2026-09-11-skills-migration/`.

## What is preserved

Spec-driven planning, code-grounded exploration, structural decisions, frontier questions, ticket quizzes, product/technical separation, vertical slices, expand–contract migrations, independent workers, three review lenses, scoped tests, full-suite integration gates, bounded repair loops, failing debug reproduction, hypothesis rollback, artifact handoff, proactive knowledge capture, and configurable model roles remain.

The existing seventeen packages remain, with `ask-codebase` added as a lightweight read-only entry. Workflows are still multi-step skills. Worker contexts remain native host subagents. The four separately loaded persona packages are removed; their useful criteria move to operation and review contracts.

## Validation

```sh
node --test tests/*.test.mjs
node skills/use-workflow/scripts/agentic.mjs validate-library .
node skills/use-workflow/scripts/agentic.mjs --help
```

The contract suite uses temporary repositories and directories. It exercises actual file hashes, profile matching, path traversal/symlink checks, state compare-and-swap, scheduling, plan sealing/import, evidence mapping, change impact, telemetry, broken knowledge links, reverted-commit resumption, and concurrent worktree isolation. It makes no network requests and does not alter this repository's Git history.

Behavioral application checks and example compiler/runtime checks are recorded separately from these deterministic tests. They do not establish cross-model performance parity. A repeatable Astra/Fable evaluation campaign is supplied for review and further testing; no token, latency, or quality improvement is claimed without measurements.

## Compatibility

Legacy qualified skill names are preserved. `agentic:skill:review-loop` resolves as a compatibility alias to the existing `agentic:workflow:review-loop` identity. Plain package-name aliases are in the registry; strict host format adaptation belongs to the installer/host, not edits to protected source. The external `agentic-cli` implementation has not been modified or claimed compatible with untested behavior.

State retains `workflow-state.yaml` but uses JSON syntax, a YAML 1.2 subset, with schema version 2. Older state requires explicit conversion and evidence reconciliation; stale labels never acquire new approvals. Existing prose plans can be imported into the durable manifest contract, then validated and accepted before execution.
