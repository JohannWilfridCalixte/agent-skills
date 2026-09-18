# Agentic

A skills library for spec-driven development and a living project knowledge base. The model interprets the workflows; the host supplies tools and native worker contexts. Configuration, execution state, delegation, review, and durable knowledge each have one owner.

Plan from evidence, resolve structural decisions, implement verifiable tickets, review the resulting behavior, and reconcile what the project now knows. Existing workflows and engineering policies remain detailed where that detail carries intent.

## Install and discover

All prompt packages live under `skills/`. A workflow is an ordinary skill with progressive step files. There is no separate persona package or persona boot sequence. Native subagents still perform independent exploration, implementation, and review.

For a repository-local installation, expose each complete package to the host's skill directory. For example, with Codex's `.agents/skills` layout, create one link per skill directory:

```sh
mkdir -p .agents/skills
for package in skills/*; do
  [ -d "$package" ] || continue
  name=$(basename "$package")
  [ -e ".agents/skills/$name" ] || [ -L ".agents/skills/$name" ] || ln -s "../../$package" ".agents/skills/$name"
done
```

Do not overwrite existing installations automatically. Copying is also valid when the host cannot follow links, provided each package includes every supporting file. Install the complete library for workflow use, or resolve the selected package's `agentic.json` dependency closure. Profiles can add required engineering packages beyond static dependencies. Installed packages are not automatically loaded into every conversation.

Existing qualified invocation names are retained for compatibility; [the registry](skills/use-agentic/references/registry.json) lists canonical IDs and plain-name/legacy aliases. A host requiring lowercase hyphenated metadata needs an adapter that maps those aliases. Do not rewrite the protected TypeScript source to implement such an adapter. Verify the host's discovery behavior rather than assuming every skill installer accepts namespaced metadata.

The separate [agentic-cli repository](https://github.com/JohannWilfridCalixte/agentic-cli) is an optional installer integration. Its implementation and current compatibility are outside this repository. The local validator checks package structure and dependency closure; it does not certify an external installer.

## Workflows

| Skill | Use it for | Retained mechanism |
|---|---|---|
| `technical-planning` | Turn a spec, idea, or issue into an accepted plan | Context → structural questions → PRD/plan/tickets → quiz → handoff |
| `implement` | Execute a validated, accepted planning directory | Validate → independent ticket lanes → full-suite integration → finalize |
| `debug` | Investigate a reproducible defect | Evidence → behaviorally failing test → bounded hypothesis/fix attempts → review |
| `pr-review` | Review one or more pull requests | Repository-qualified context → independent review lenses → local or authorized posted report |
| `ask-codebase` | Answer a question about behavior or rationale | Targeted knowledge/code retrieval → evidence-backed answer with unknowns; read-only |
| `review-loop` | Shared bounded review/repair execution | Explicit report/repair mode; parallel lenses; deduplication; finite repair budget |

Example invocations, when supported by the host:

```text
/agentic:workflow:technical-planning Add idempotent payment requests
/agentic:workflow:implement docs/specs/idempotent-payments
/agentic:workflow:debug Duplicate webhook deliveries create duplicate orders
/agentic:workflow:pr-review owner/repository#123
/agentic:skill:ask-codebase Why do we retry this operation three times?
```

A missing required plan stops implementation. [External-plan import](skills/technical-planning/references/import-plan.md) adapts another planner's output to the same validation and acceptance contract; it does not bypass the gates.

## Skill ownership

| Skill | Owns |
|---|---|
| `use-agentic` | Config lookup, profile/skill selection, model roles and host capabilities |
| `use-workflow` | Run lifecycle, state, gates, revision binding, evidence, helper commands |
| `delegate-work` | Bounded task dispatch, direct skill loading, write scope and result contracts |
| `use-knowledge` | Retrieval, durable classification/capture, indexes, provenance, reconciliation |
| `review-code`, `review-tests`, `review-security` | Their respective review criteria; common result contract supplied by the loop |
| `code-testing` | Behavioral tests, useful boundaries, isolation, coverage interpretation |
| `clean-architecture` | Domain/use-case/adapter boundaries and dependency direction |
| `python-engineer` | Python typing, errors, imports, patterns and style |
| `write-instrumented-code` | Structured observability, required metadata, redaction and exception-safe tracing |
| `typescript-engineer` | The complete existing TypeScript policy and reference hierarchy, unchanged |

Workers receive task goals, skill names and resolvable paths, input revisions, owned files, and required results. They load the actual skills and applicable nested references; summaries do not replace the TypeScript rules. Independent workers keep their context and files isolated. One orchestrator owns shared state and Git integration.

## Configure once

Read the first existing project file in this order: `.agentic.json`, `.agentic.config.json`, `.agentic/config.json`; then `~/.agentic/config.json`; then defaults. Shadowed configurations are reported, not merged. Invalid configuration is a visible dependency error.

```json
{
  "namespace": "agentic",
  "specFolder": "docs/specs",
  "maxWorkers": 3,
  "issueClosePolicy": "merge",
  "profiles": [
    {"name": "frontend", "detect": ["src/**/*.ts", "src/**/*.tsx"], "skills": ["agentic:skill:typescript-engineer"]}
  ],
  "selectedProfiles": [],
  "ides": {
    "codex": {
      "outputFolder": ".agentic/output",
      "models": {
        "high_thinking": {"model": "gpt-6-astra", "effort": "high"},
        "code_writing": {"model": "gpt-6-astra", "effort": "high"},
        "qa": {"model": "gpt-6-astra", "effort": "high"},
        "exploration": {"model": null, "effort": null}
      }
    }
  }
}
```

The checked-in configuration also requests `claude-fable-5-1` for Claude roles. Model identifiers are requests to the host, not promises of availability. Unsupported model/effort controls fall back visibly to the inherited host context. Exploration inherits the host default. Measure routing changes before claiming efficiency gains.

Explicit profiles, task-path detection, explicit task skills, and semantic applicability contribute to one deduplicated skill list. Empty `selectedProfiles` does not omit language rules. See the [configuration contract](skills/use-agentic/references/config-schema.md) and [host adapter](skills/use-agentic/references/host-adapter.md).

## Durable intent and run evidence

```text
docs/specs/<topic>/             accepted PRD, plan, tickets, sealed plan.json
docs/tech/adr/                  accepted technical decisions and successors
docs/tech/rfc/                  unresolved proposals
docs/product/                  current user-visible behavior
docs/ubiquitous-language/       domain terminology
docs/landing-zone/              proposed or mixed knowledge
.agentic/output/<flow>/<run>/   state, logs, checks, reviews, telemetry, proposed captures
```

Use the exact knowledge taxonomy in [use-knowledge](skills/use-knowledge/SKILL.md) when creating records; existing projects may already have the documented category paths. Accepted specs belong in versioned documentation; execution logs are not their only source of truth. Commit/publish remains subject to the user's delivery instructions.

`plan.json` binds stable acceptance IDs to tickets, dependencies, file ownership and artifact hashes. Gate receipts bind approval to a sealed revision. On scope change, compute affected tickets and descendants, preserve justified unaffected work, and revalidate affected approvals/evidence. A green suite alone does not establish every acceptance criterion.

State uses JSON syntax in `workflow-state.yaml` (valid YAML 1.2), version 2. One writer uses version checks and atomic replacement. Resume checks repository identity, plan revision, commit reachability and current effects; a reachable reverted commit is insufficient. Ticket Markdown is a derived status view.

## Review and delivery

Blockers and majors both request changes. Cosmetic findings never become blockers merely because a reviewer prefers another style. Report mode returns findings without changing code; repair mode preserves bounded fix/re-review cycles. Debug always reviews code/tests and includes security under its explicit risk conditions.

Implementation prefers isolated worktrees and a serialized integration gate. Workers run scoped checks; the orchestrator verifies the exact integrated candidate with the full suite and stages only the ticket's owned paths. In no-commit mode it records `integrated` with snapshot evidence; it never claims a commit occurred. Issue closure follows verified merge by default. Local, posted, batch and cross-repository PR review remain supported with explicit head identity and retry-safe publication records.

Existing user approval is reused for the same unchanged scope. Tool success and elapsed time are not approval. Remote publication still needs the user's authorization; the workflow does not send messages merely because it generated a report.

## Local tools and tests

Node.js 22+ is sufficient for the dependency-free helper:

```sh
node skills/use-workflow/scripts/agentic.mjs --help
node skills/use-workflow/scripts/agentic.mjs validate-library .
node --test tests/*.test.mjs
```

It validates packages, state, ticket graphs, accepted-artifact hashes and knowledge links; resolves configuration; produces requirement coverage/change-impact/telemetry views; checks resume evidence; and imports/seals plan artifacts. It does not execute model workflows, approve gates, mutate Git, or contact external services. Commands return JSON and failures exit nonzero.

[Evaluation fixtures](tests/evals/README.md) compare no-library, original-library and migrated-library conditions with repeated samples and explicit quality/efficiency metrics. [Migration review notes](docs/migration/README.md) map every accepted recommendation to its owner and validation evidence. Tests and evidence distinguish source application, deterministic runtime checks, and unperformed cross-model benchmarks.
