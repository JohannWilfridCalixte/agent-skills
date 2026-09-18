# Step 2: Grill Requirements

Build a design tree from input, accepted knowledge and technical context. Nodes are decisions; edges are prerequisites. The frontier contains unresolved questions whose prerequisites are settled. Reuse explicit decisions already made for unchanged scope, with their evidence; do not ask them again.

Each round asks frontier questions with recommended answers and concrete trade-offs. Ask all eligible questions in bounded batches: at most four or the host question-tool limit, whichever is lower; overflow waits for the next round. Answers may prune branches or create decisions; recompute the frontier. Codebase facts belong to delegated lookups, never to developer guessing. Structural choices belong to the developer.

Consider relevant categories, skipping clearly irrelevant ones:

0. Product problem, users and out-of-scope, only if input lacks them.
1. Architecture, component boundaries and integration points.
2. Data models, storage, migrations, caches and validation.
3. API shapes, error semantics and versioning.
4. Dependencies, versions and trade-offs.
5. State, data flow and side effects.
6. Failure modes, edge cases, retry and recovery.
7. Security, authentication, authorization and sensitive data.
8. Test strategy, meaningful boundaries and critical coverage.
9. Performance requirements and scaling.

If the developer says “you decide” or equivalent, push back once with specific choices. If they insist, recommend an option, obtain confirmation and log `DEVELOPER_DEFERRED` with rationale. Existing explicit authorization satisfies this gate; do not repeat it mechanically.

Maintain `technical-decisions.md`: stable decision ID, question, answer, derived decision, rationale, plan impact and approval evidence. Parent also records autonomous decisions in state. Classify significant knowledge inline through `use-knowledge`; it owns ADR/RFC/glossary thresholds and numbering. Cite resulting records without duplicating their contents.

Before generation, check the whole tree, not just an empty frontier. Cyclic prerequisites or inaccessible decisions can leave unresolved structural questions without an eligible question. Structural means architecture, data model, API, boundaries or library choices that change implementation shape: list unresolved items and keep grilling. Minor naming/log/comment defaults may remain with rationale and developer confirmation. Record a structural gate tied to decision evidence; no generation before it is satisfied.

When only confirmed minor defaults remain, update state and load step 3.
