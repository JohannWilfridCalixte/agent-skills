# Import an external accepted plan

Import adapts another planning tool's output into the same durable specification contract. It does not make arbitrary prose valid implementation input.

1. Initialize a planning run and preserve the supplied plan and acceptance provenance. Retrieve relevant knowledge and delegate any missing factual code context through step 1. Reuse explicit structural answers already present; surface unresolved or conflicting decisions through step 2.
2. Prepare `source.json` with `spec_id`, `product` and `technical` Markdown strings, stable `requirements`, `tickets` (shared ticket shape without `path`) and `decisions`. User approval evidence belongs in the run gates, not an invented source flag.
3. Run the shared helper `import-plan <source.json> <{execution_context.spec_folder}/spec-id>`. It creates draft PRD/plan/tickets plus a sealed `plan.json`; it grants no approval. Validate the returned contract and ownership/dependency graph through step 3. Preserve existing artifacts; conflicting destinations require a deliberate revision, not overwrite-by-default.
4. Reconcile exact imported content with prior acceptance evidence. Present the ticket quiz for new or changed breakdown/scope in step 4. Carry explicit existing answers when they cover the imported revision, recording the evidence binding. Unanswered structural questions and missing quiz approval still block.
5. Only actual approval in step 4 produces the durable acceptance.json receipt; import itself never creates approval. Handoff through step 5 with durable paths, accepted revision and validated receipt. Implementation still requires the valid sealed plan and approval gates; import failure does not authorize a prose-plan bypass.
