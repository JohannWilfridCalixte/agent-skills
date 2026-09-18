# Capture, allocate, and promote

## Worker proposal

When valuable knowledge surfaces during planning, implementation, or review, preserve it immediately in the permitted output scope. Each worker returns a unique capture ID `{run-id}-{task-id}-{random8hex}` and a Proposed record in `<run>/knowledge/proposals/<capture-id>.md`, or returns its complete body if artifact writes are unavailable. The orchestrator assigns this unique path before dispatch. Workers do not choose ADR/RFC numbers or edit shared indexes.

Proposal fields: capture ID; title; `Status: Proposed`; captured date; classification suggestion; statement; rationale; source paths/links and code/spec revision; authority (observed/user-accepted/assumption); related requirement/ticket/decision IDs; conflicts; and potential destination. A proposal preserves known user acceptance with its exact evidence but is still a proposed documentation change until the writer validates it.

## One canonical writer

The run orchestrator owns canonical docs and numbering. If multiple runs affect the same docs, establish one repository writer before allocation; other runs queue proposals to that owner. Do not run independent `ls → next-number → write` sequences in workers.

For each accepted capture in order:

1. Retrieve existing related docs and compare content/authority. Merge duplicate captures into the existing record; keep their evidence.
2. For a new ADR or RFC, inspect its directory immediately before allocation. Allocate the next unused four-digit number in that category; create without overwriting an existing file. If the number now exists, reread and allocate the next number. The writer holds ownership through document and index updates.
3. Fill the corresponding template and status. New unresolved decisions are Proposed/Open; explicitly established decisions may be Accepted with their authority receipt. Routine documentation of accepted decisions or observed facts needs no extra user gate.
4. Update section/root indexes and relevant backlinks in the same serialized batch. Link the originating capture/run and related spec/requirement IDs. Record the resulting path in run `knowledge`/`artifacts`.
5. Resolve `<helper>` to the installed use-workflow skill's absolute `scripts/agentic.mjs` path. Validate links and number uniqueness with `node <helper> validate-knowledge docs`, then inspect statuses and semantic consistency. Helper validation does not approve a decision.

Example: two workers discover distinct architectural decisions when the highest ADR is 0011. They return separate Proposed capture IDs. The writer checks authority, creates 0012 and its index entry, then rechecks and creates 0013. If they describe the same decision, merge evidence rather than manufacturing two ADRs.

## Threshold and lifecycle

Use the entry point's classification threshold. A firm but routine local choice remains in the reasoned run log. A reusable unresolved technical trade-off is an RFC; uncertain cross-topic content goes to landing-zone. Do not lose useful knowledge because its final category is unclear.

RFC resolution creates an ADR and marks the RFC `Decided → ADR-NNNN` with an actual link. Superseding an ADR preserves its context/rationale, adds a successor link and status, and gives the successor a `Supersedes` backlink. Accepted successor status requires authority. Deprecation records why a decision no longer applies. Promotion/renaming repairs every affected index/backlink; retain redirects or an explicit history link where readers need the previous location. Periodically triage landing-zone records with clear status/destination.

A completed run with no durable changes records `knowledge.reconciliation` as unchanged with a reason and inspected sources; it creates no empty project document. A standalone read-only answer requires no state or documentation write.
