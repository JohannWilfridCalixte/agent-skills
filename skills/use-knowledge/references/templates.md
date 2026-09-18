# Knowledge formats

Load the format being written. Keep metadata concise and evidence-specific. Older documents without provenance are readable but unverified until checked; do not invent historical dates or authority.

## Shared provenance

Add applicable fields below to durable records. Status/date remain required for ADRs, RFCs, and landing-zone records.

```markdown
**Status:** Proposed
**Date:** YYYY-MM-DD
**Authority:** User instruction / accepted ADR or spec / observed code / assumption
**Sources:** Source paths or links, including run/issue/PR where available
**Source revision:** Code or sealed spec revision supporting the claim
**Last verified:** YYYY-MM-DD at revision (or Unverified)
**Relevant paths:** Components whose changes require revalidation
**Related:** Requirement IDs, spec/ticket IDs, ADR/RFC links
```

Facts, decisions, assumptions, and proposals are distinct. An update date says when text changed; `Last verified` says which evidence was checked. Add `Supersedes` and `Superseded by` links when applicable.

## ADR

File: `docs/tech/adr/NNNN-slug.md`, allocated by the canonical writer.

```markdown
# NNNN - Title

**Status:** Proposed | Accepted | Deprecated | Superseded by [successor](NNNN-successor.md)
**Date:** YYYY-MM-DD
**Authority:** Exact acceptance source, or unresolved
**Sources:** Relevant evidence
**Last verified:** Revision/date, or Unverified
**Related:** Spec, requirements, tickets, and other decisions

## Context

Why this decision is needed and the forces at play.

## Decision

The specific accepted or proposed choice.

## Rationale

Why this choice over alternatives; the trade-off that tipped the scale.

## Alternatives Considered

Discarded options and their disadvantages. Omit when not relevant.

## Consequences

Positive and negative effects, constraints, and follow-up obligations.
```

Superseded ADRs preserve their original rationale. Their status contains a real successor link; the successor links back. A Proposed successor does not silently override an Accepted predecessor.

## RFC

File: `docs/tech/rfc/NNNN-slug.md`, allocated separately from ADR numbering.

```markdown
# NNNN - Title

**Status:** Open | Decided → [ADR-NNNN](../adr/NNNN-decision.md) | Abandoned
**Date:** YYYY-MM-DD
**Sources:** Relevant evidence
**Related:** Specs, requirements, and prior decisions

## Problem

What needs resolving and why existing evidence cannot settle it.

## Options

### Option A — Name

Pros, cons, evidence, and uncertainty.

### Option B — Name

Pros, cons, evidence, and uncertainty.

## Open Questions

- The unresolved decisions and evidence needed.
```

Once decided, create/link the ADR, update RFC status, and repair both indexes.

## Ubiquitous language

Simple terms belong in `docs/ubiquitous-language/README.md` as a glossary table. Complex terms also get a linked `<term>.md`:

```markdown
# Term

## Definition

One clear sentence.

## Context

Why the term matters, what it replaces, and common confusion.

## Examples

Concrete usage in this domain.

## Sources

Accepted definition and relevant code/product evidence.
```

## Product documentation

File: `docs/product/<topic>.md`. Adapt its layout to the feature; identify intended behavior, stable requirement IDs when applicable, constraints, related accepted decisions, and last verified implementation evidence. Distinguish current behavior from planned/proposed behavior.

## Landing zone

File: `docs/landing-zone/<topic>.md`.

```markdown
# Topic

**Status:** Proposed | Needs evidence | Ready for promotion
**Date:** YYYY-MM-DD
**Potential destinations:** ADR / RFC / product / glossary
**Sources:** Evidence and origin
**Related:** Requirements/decisions when known

Concise knowledge, uncertainty, and next discriminating action.
```

## Indexes

Every section has a README linking all entries with one-line descriptions. `docs/README.md` links the active sections; `docs/tech/README.md` links ADR/RFC indexes. Preserve status cues so discovery does not present a superseded decision as current.

| Entry | Status | Description |
|---|---|---|
| Document link | Current/Proposed/Historical | One-line purpose |

Update indexes for addition, modification, rename, removal, and promotion. Freeform topics do not waive discoverability.
