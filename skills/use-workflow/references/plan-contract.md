# Durable plan, revision, and coverage

Accepted PRD, technical plan, and ticket files live in `<spec_folder>/<slug>/`, default `docs/specs/<slug>/`. Run logs remain under `output_folder`. A fresh checkout can reconstruct accepted intent without the original chat. Runtime ticket statuses remain in run state; any Markdown status display is derived.

## Machine-readable plan

`plan.json` is the canonical manifest:

```json
{
  "schema_version": 1,
  "spec_id": "retry-policy",
  "revision": "sha256:SEALED_REVISION",
  "prd": "prd.md",
  "technical_plan": "technical-plan.md",
  "requirements": [{"id": "AC-001", "text": "Transient failures retry at most three times.", "status": "active"}],
  "tickets": [{"id": "01", "title": "Bound transient retries", "path": "tickets/01-retry-policy.md", "blocked_by": [], "requirements": ["AC-001"], "files": ["src/retry.ts"], "acceptance": ["Transient failures stop after the third attempt."]}],
  "decisions": [{"id": "D-001", "decision": "Use a bounded retry policy", "reason": "AC-001 requires a known upper bound."}],
  "artifacts": [{"path": "prd.md", "sha256": "CONTENT_HASH"}, {"path": "technical-plan.md", "sha256": "CONTENT_HASH"}, {"path": "tickets/01-retry-policy.md", "sha256": "CONTENT_HASH"}]
}
```

Paths in the manifest are relative to its spec directory and stay inside it; ticket `files` are repository-relative write scopes. IDs are unique and stable. Every dependency resolves; the graph is acyclic. Each active requirement maps to ticket acceptance, and each ticket cites requirement IDs. A one-ticket plan is valid. Deferred requirements are explicit; removing a requested criterion is not acceptance.

`seal-plan <plan.json>` hashes PRD, plan, and ticket Markdown plus semantic manifest fields to produce a content-bound revision. `validate-plan <plan.json>` checks structure, references, dependency graph, and hashes. Sealing proves content identity; it does not approve intent. State `plan.accepted_revision` comes from the user's structural/ticket approval gates. Editing any sealed content requires resealing and impact assessment before dependent implementation.

Keep a durable `acceptance.json` beside the plan so a fresh checkout can recover real approval: `{schema_version: 1, spec_id, revision, accepted_at, gates: [...]}`. Gates use the state gate shape with exact revision, scope, and original acceptance evidence. This receipt is excluded from the content seal to avoid a circular hash. Run `validate-acceptance <plan.json> <acceptance.json>` before importing acceptance into a new run. A receipt is written or replaced only when actual user acceptance supports it; preserve prior receipts in history. Importing or sealing content never fabricates approval.

## Operations

Use `node <helper>` followed by:

| Command | Result and caller responsibility |
|---|---|
| `frontier <plan.json> <state.yaml>` | Computes ready dependency candidates. Orchestrator also checks write overlap, capacity, accepted revision, and isolation before dispatch. |
| `coverage <plan.json> <state.yaml>` | Summarizes requirement evidence; inspect whether each cited check actually establishes its criterion. |
| `impact <old-plan.json> <new-plan.json>` | Identifies changed scope and dependency impact; retain old sealed revision for comparison. |
| `resume-check <plan.json> <state.yaml>` | Checks saved plan/repository evidence; verify effects and check freshness before skipping completed tickets. |
| `validate-acceptance <plan.json> <acceptance.json>` | Checks durable approval binding for a fresh checkout; caller verifies the recorded user evidence. |
| `import-plan <source.json> <destdir>` | Converts external plan content into the durable contract; validation and acceptance gates still follow. |

Save old and new plan manifests for impact comparison. Changed requirements become `changed`; missing evidence stays `unverified`; deliberately excluded scope is `deferred`. A requirement is `satisfied` only when a passing check receipt with matching code/plan revision directly verifies the named criterion. A passing suite without mapped assertions is not proof of every requirement. Link related ADRs, tickets, commits, PRs, and live docs through their records; avoid duplicating decision bodies.

## Import boundary

Import is an explicit route for external plans, not a relaxation of implementation's plan gate. Use the technical-planning skill's [import procedure](../../technical-planning/references/import-plan.md). The source object supplies `spec_id`, `product` and `technical` Markdown strings, `requirements`, `tickets` (the shared ticket shape without generated `path`), and `decisions`. Preserve original source provenance and unresolved questions. Run import and validation; resolve structural gaps through technical-planning and present the resulting concrete plan/ticket set for acceptance. Existing explicit acceptance of the same content can supply gate evidence, but missing structure or changed content cannot inherit imaginary approval. No implementation starts from unvalidated prose merely because its filename contains “plan.”

The impact helper checks both semantic manifest changes and sealed Markdown hashes. A changed ticket artifact affects that ticket and its descendants. A changed shared PRD/design artifact or decision has unknown scope until classified, so the default is conservative invalidation of all tickets; record a concrete evidence-backed classification before carrying any unaffected result forward. Path aliases such as `src/./file.ts` normalize to the same owned file when checking overlap.
