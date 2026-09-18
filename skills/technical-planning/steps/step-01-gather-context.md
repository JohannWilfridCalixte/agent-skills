# Step 1: Gather Codebase Context

Retrieve relevant accepted ADRs, product documentation, domain terms and prior specs through `use-knowledge`; record source, status, revision and conflicts in a small knowledge packet. Read the input and current repository identity from the initialized run.

Delegate exploration through `delegate-work`: exploration model role, selected profile skills, source-read-only/report-write capability, input/spec paths, repository base/head or snapshot identity, knowledge packet and [exploration guidance](../../delegate-work/references/exploration.md). One or more independent workers may cover disjoint questions. Assign unique report paths; the parent synthesizes `technical-context.md` using [the template](../references/technical-context.md).

Workers explore broadly then narrow to affected paths, patterns and dependencies, including downstream and second-order effects. Cite specific files/revisions. Separate observed facts, assumptions, constraints and unknowns. They do not choose structural product/design decisions or mutate source.

Validate the context against the input and cited code: coverage of relevant components, current evidence, uncertainties and knowledge conflicts, not merely existence/nonempty text. Re-delegate missing or incorrect evidence.

Present a concise summary and preserve the correction gate: “Anything wrong or missing?” Reuse an explicit prior confirmation of this same context. Corrections go to the exploration worker and are re-presented. If confirmation is absent, record `awaiting_input`; do independent factual lookups while waiting, but do not treat silence as confirmation.

Parent records `artifacts.technical_context`, knowledge retrieval and gate evidence with the context revision, updates state, then loads step 2.
