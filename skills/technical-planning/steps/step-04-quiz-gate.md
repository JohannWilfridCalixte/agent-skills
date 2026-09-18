# Step 4: Quiz Gate

Present every ticket with stable ID, title, blockers, acceptance IDs and delivered outcome. Summarize PRD scope, design decisions and verification approach. Ask the developer:

1. Is granularity right for a fresh worker context?
2. Are blocking edges correct, including shared ownership?
3. Should any tickets merge or split?
4. Is anything wrong in the plan or PRD?

Reuse explicit approval already given for these exact artifacts and scope. Answered questions alone, silence or a prior approval of different content do not constitute acceptance. On changes, regenerate affected artifacts, preserve stable IDs, rerun `seal-plan` and `validate-plan`, re-present changed scope and quiz again. Do not re-ask unchanged structural decisions.

Parent records `gates[]` with `id`, `kind: plan_acceptance`, `status: approved`, exact `revision`, affected ticket/requirement IDs in `scope`, and developer approval `evidence`. Set `plan.accepted_revision` to that sealed revision only when all required scope is approved. Log decision/reason, not merely a ticket count. Subsequent semantic changes use the shared impact contract to invalidate affected gates/checks and rebind retained evidence explicitly. Archive superseded receipts under `history` with reason/candidate before replacing active records with current pending gates; never archive a still-required failure to manufacture completion.

Persist that actual approval in durable `{execution_context.spec_folder}/<spec-id>/acceptance.json`:

```json
{"schema_version":1,"spec_id":"<spec-id>","revision":"<sealed-revision>","accepted_at":"<observed-ISO-time>","gates":[{"id":"<gate-id>","kind":"plan_acceptance","status":"approved","revision":"<sealed-revision>","scope":["<ticket-or-AC-id>"],"evidence":"<actual developer approval and provenance>"}]}
```

Use real approval evidence, including structural and ticket approval scope, rather than template text or only an inaccessible transient path. Exclude this receipt from the content seal to avoid a circular hash; it binds to the already sealed revision. Preserve superseded receipts as history when resealing. Run shared `validate-acceptance <plan.json> <acceptance.json>` before handoff. The helper validates binding/coverage, not whether invented approval is genuine.

No handoff before complete approval of the current validated revision. Pending input means `awaiting_input`, not completed. Once approved, load step 5.
