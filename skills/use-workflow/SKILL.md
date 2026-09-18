---
name: agentic:skill:use-workflow
description: Use when starting, advancing, resuming, or finalizing an Agentic workflow with durable state and approval gates
---

# Use Workflow

Keep one canonical run record. The orchestrator owns it; workers return results and unique artifacts. Required setup: `agentic:skill:use-agentic` resolves the execution context once.

Resolve the helper from the installed use-workflow package: `<helper>` means its absolute `scripts/agentic.mjs` path. Consumer repositories need not contain this library's `skills/` tree.

1. Generate `{YYYYMMDD}-{HHMMSS}-{random4hex}` and create `{OUTPUT_FOLDER}/{workflow-name}/{run-id}/`. Initialize `workflow-state.yaml` from [the state template](references/workflow-state.yaml). It uses JSON syntax, which is valid YAML 1.2. Read [state-contract.md](references/state-contract.md) before the first update.
2. Save state through `scripts/agentic.mjs save-state`. Combine configuration and run initialization into one concise receipt. Record repository identity and accepted plan revision when applicable.
3. Read only the current step file. Complete its work and gates before loading the next. After each step, decision, artifact, check, or gate outcome, the orchestrator validates and atomically saves the next state. Every autonomous decision includes its reason and step context.
4. On interruption or changed scope, use the [state contract](references/state-contract.md) to verify repository/plan evidence and invalidate affected gates. Existing authorization remains valid for unchanged scope; a repeated question is not a substitute for checking its receipt.
5. Finalize only after required checks, review results, requirement evidence, and knowledge reconciliation are recorded. Failures remain visible; a failed or unavailable check does not count as passing.

Accepted specifications live in the configured durable `spec_folder` (default `docs/specs`); transient logs and review artifacts live in the run. See [plan-contract.md](references/plan-contract.md) for revisions, dependency validation, coverage, and import. See [telemetry.md](references/telemetry.md) when recording measurements.

Use normal concise prose, respecting the user's and host's communication preferences. Report findings, uncertainty, next action, and relevant evidence. Initialization and routine checkpoint messages are announcements, not new permission gates.
