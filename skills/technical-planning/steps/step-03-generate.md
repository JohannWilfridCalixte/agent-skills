# Step 3: Generate PRD, Plan, Tickets

Precondition: structural decisions resolved. Preserve the generation choice: orchestrator generation (recommended for compact context) or a native document-writing worker (useful for a long conversation). Reuse a prior explicit choice. If delegating, use the high-thinking model role, selected skills, input/context/decision paths and these templates; the worker returns artifacts, not shared state edits.

Create a durable draft in `{execution_context.spec_folder}/<spec-id>/`:

| Artifact | Content |
|---|---|
| [prd.md](../references/prd.md) | Product problem, users, outcomes, stories and out-of-scope; no implementation/testing decisions |
| [technical-plan.md](../references/technical-plan.md) | Scope, design, contracts, verification, decision/ADR references, minor defaults |
| [tickets/NN-slug.md](../references/ticket.md) | Stable ticket ID, end-to-end delivery, known dependencies, exact file ownership, acceptance IDs |
| `plan.json` | Shared machine-readable plan contract, requirements, tickets, decisions and sealed Markdown artifacts |

Reflect every accepted decision without silently reinterpreting it. Allocate stable `AC-...` requirement IDs; preserve IDs across wording edits, splits/reordering where the requirement identity survives, and link new IDs when meaning splits. The parent maintains revision history and explicit supersession. Ticket IDs remain stable when presentation order changes; paths may be reordered without silently renaming IDs.

Keep vertical, independently verifiable slices sized for one fresh worker context; a single ticket is valid. Infrastructure/refactor tickets deliver a complete verifiable boundary without inventing schema/API/UI layers. Prefactor first. Wide migrations use expand → independent migrate batches blocked by expand → contract blocked by all batches. Add an ordering edge for shared owned files/resources; file-disjointness alone does not prove runtime isolation.

Resolve the helper from the installed `use-workflow` skill's `scripts/agentic.mjs`; run `seal-plan <spec-dir>/plan.json`, then `validate-plan <spec-dir>/plan.json`. The plan contract requires schema_version=1, spec_id, revision, prd, technical_plan, requirements, tickets, decisions and artifact hashes. Validate unique IDs; nonempty acceptance; known requirement/blocker references; no cycles; complete ticket-to-requirement mapping; safe, existing relative paths; and serialized overlapping ownership. Invalid graphs/artifacts return to generation, never to quiz or handoff.

Record durable paths and revision in parent `plan`/`artifacts`; execution status remains in run state, never canonical ticket Markdown. All drafts remain unapproved until step 4. Load the quiz only after validation passes.
