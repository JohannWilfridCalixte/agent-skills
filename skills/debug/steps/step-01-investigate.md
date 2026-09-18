# Step 1: Investigate

Retrieve relevant accepted knowledge through `use-knowledge` and record conflicts/freshness. Parent records repository/base/head, initial user changes and assigned diagnostic scope. Preserve the model-choice question: code-writing or high-thinking role for investigation; reuse an existing explicit answer and resolve the chosen role through `use-agentic`.

Delegate one or more bounded investigations through `delegate-work`, using selected profile skills, [exploration guidance](../../delegate-work/references/exploration.md), the bug report and knowledge packet. Workers are source-read-only and may write only their unique reports. Parent combines results into `investigation-report.md` using [the template](../references/investigation-report.md).

Workers must:

1. Read complete relevant errors/traces; preserve diagnostic structure while redacting sensitive values.
2. Locate failure component and precise file/line at the recorded revision.
3. Trace data backward from failure to the origin of bad state.
4. Inspect relevant recent Git history/diffs read-only, or request parent-provided artifacts when that capability is unavailable.
5. Compare similar working code and existing patterns.
6. Record observed facts, unknowns, assumptions, environmental/intermittent factors and downstream effects separately.

Parent verifies citations/current revision, failure/dataflow analysis and evidence quality. Missing sections or unsupported claims return to the worker with specific gaps. Do not accept an attractive hypothesis without supporting evidence.

Present findings and preserve the correction gate: “Anything wrong or missing from this investigation?” Reuse prior confirmation of this same evidence. Corrections trigger refinement; absent required confirmation leaves awaiting_input, with independent factual lookups continuing where useful.

Record artifact paths, model choice, context gate and knowledge provenance in parent state; load step 2 after confirmation.
