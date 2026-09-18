# Retrieve a focused knowledge packet

## Start from the task

Identify the question, affected components, relevant paths, and current code/spec revision. Read `docs/README.md` if present, then relevant section indexes: `docs/tech/README.md`, `docs/tech/adr/README.md`, `docs/tech/rfc/README.md`, `docs/product/README.md`, `docs/ubiquitous-language/README.md`, `docs/landing-zone/README.md`, and durable spec indexes. Follow relevant links rather than loading every document.

Missing indexes are a discovery gap, not proof that knowledge is absent. Search targeted document filenames/content and code/history with `rg` and Git. In read-only mode, report an index gap without creating files. In an authorized writing run, include its repair in reconciliation.

Retrieve accepted decisions and their source evidence before asking a user to decide them again. For each superseded/deprecated record follow successor links until reaching a current record. Retain the historical rationale when it explains the question. Detect missing successor links, cycles, conflicting Accepted records, and a Proposed successor; none establishes a replacement policy automatically.

Verify behavior against relevant code/tests/configuration at the recorded revision. Read history/issue/PR evidence when rationale is not in code. An unavailable remote source remains an explicit unknown. Do not infer intent from file modification time or from a green test alone.

## Packet fields

The packet can be a bounded response or a unique run artifact; a read-only question does not require writing a packet file. For each claim provide:

| Field | Meaning |
|---|---|
| `claim` | Concise fact, decision, assumption, or proposal. |
| `source` | Actual path/link and useful line anchors; observed source revision when known. |
| `status` | Accepted, Proposed, superseded/historical, observed, or unverified. |
| `authority` | User acceptance, accepted ADR/spec, observed code/test, or inference. |
| `relevance` | Constraint or answer this contributes to the current task. |
| `freshness` | Last verified revision/date and whether affected paths have changed. |
| `conflicts` | Contrary claim and source, missing successor, or unresolved mismatch. |

Include requirement IDs and related ticket/ADR IDs where they exist. Separate current policy from historical rationale and observed implementation. Current user instructions govern authorized task scope; an accepted ADR documents intended architecture; shipped code establishes observed behavior. Neither code nor document recency automatically changes an accepted decision. When these conflict, preserve both sources and use reconciliation.

## Stop condition

The packet answers the scoped question or states exactly which fact/decision cannot be established and what evidence would resolve it. Cite inspected evidence. Avoid turning every unknown into a new user question: inspect available code/docs/history first, then ask only if the next required decision cannot be resolved from evidence.
