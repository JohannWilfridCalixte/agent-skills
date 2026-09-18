# Evidence-grounded exploration

Use for planning context, bug investigation, PR context, and codebase questions. The output explains what exists, why known choices were made, and what cannot yet be established.

## Investigation method

Start broad enough to locate relevant modules, boundaries, conventions, and dependencies, then narrow to the assigned question. Inspect existing working patterns before recommending a divergence. Trace data/control flow through callers, persistence, external services, and downstream dependents. Check second-order consequences, not only the obvious file.

Read relevant accepted knowledge through `agentic:skill:use-knowledge` retrieval: current decisions, product intent, terms, and supersession chains. Record evidence status and conflicts with observed code. Historical rationale and current behavior are different claims.

Check all relevant files for the assignment's completion condition. Explicitly examine boundary cases, races, failures, and hidden dependencies. Time pressure does not turn an unchecked assumption into a fact. If complete exploration exceeds the available scope, report what was inspected and the remaining gap; do not claim exhaustive coverage.

Use current code, tests, configuration, and revision/history evidence. Never invent requirements. When uncertainty remains in a recommendation, prefer the option with fewer downstream consequences and explain why; an unresolved structural choice goes to the orchestrator.

## Required output

| Part | Content |
|---|---|
| Answer/context | Direct answer to the task or concise system map. |
| Evidence | Specific source paths, line anchors, observed code revision, and relevant patterns. |
| Existing decisions | Accepted ADR/spec constraints, rationale sources, superseded history when relevant. |
| Dependencies and risks | Upstream/downstream effects, boundary cases, race/failure modes. |
| Facts vs assumptions | Distinguish observed behavior, documented intent, inference, and proposal. |
| Unknowns | What cannot be determined, missing evidence, and the next discriminating read/check. |

Cite inspected sources, not a file name guessed from repository structure. For bugs also follow the caller's investigation template: complete errors/stack traces, failure point, backward trace to the bad state, recent changes, and evidence-backed hypotheses. For read-only codebase questions, the direct answer and relevant evidence suffice; no speculative plan or documentation write is required.
