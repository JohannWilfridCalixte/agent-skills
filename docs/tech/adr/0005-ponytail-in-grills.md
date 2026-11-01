# 0005 - Ponytail in grills

**Status:** Accepted
**Date:** 2026-11-01

## Context

Grill recommendations drift toward the complete-looking option: extra settings, new flows, new abstractions. Nothing in the grills pushes for the smallest answer that fully works. `DietrichGebert/ponytail` (MIT) is a model-invoked skill for exactly that: a ladder from "does it need to exist?" down to minimum code, lazy on the solution but never on the change, a never-cut list, and an `ultra` level that questions the request before building. It is session-persistent until "stop ponytail".

## Decision

- **Vendor** `ponytail` verbatim into `skills/flow` (`vendor.json`, pinned in `vendor.lock.json`, `LICENSE` copied). Listed in the three plugin manifests.
- **Tech grill only**: `agentic-grill-tech` loads `ponytail` at `ultra` before `agentic-grill-me`, maps it onto grilling; ponytail mode ends when `agentic-grill-me` returns.
  - Its "before you write" scope list = fact-finding by subagent, not user questions.
  - Recommended answer = first ladder rung that fully works; skipped rungs in one line.
  - Never-cut items always on the frontier.
  - Known-limit choice = decision with the limit and upgrade trigger.
  - `docs/tech/principles.md` and accepted ADRs outrank it; the user confirms every recommendation.
  - Skipped / risk lines once, at handoff.
- **Every focus**: `agentic-grill-me` §2 carries the same spirit in our own words: smallest complete option, lean on solution never on coverage, edge-case-correct on ties, never-cut list on the frontier, deferred scope logged with limit and revisit point; handoff summary lists what was skipped or unchecked and the risks.
- **Per focus**: product asks "does it need to exist?" and prefers extending a feature; functional reuses house flows, lists what a change breaks, adds no unasked options, gives each never-cut behaviour a Given / When / Then.

## Rationale

- Lean decisions are cheapest at grill time: no code exists yet, so pushing back costs one question.
- Grilling keeps decisions with the user, so ponytail's ladder shapes recommendations, never outcomes.
- Turning it off at handoff keeps `to-plan`, `implement` and review on their own rules.

## Alternatives Considered

- **Ponytail in implement and review** (`ponytail-review` as reviewer): rejected. Plan and code-review already guard scope; two minimalism passes would fight the plan.
- **Ponytail in every grill focus**: rejected. Its rules are code-shaped; product and functional get adapted rules instead.
- **Copy its rules into the wrapper**: rejected. Vendoring keeps it byte-identical and updatable.

## Consequences

- Tech grill rounds are shorter and push back more; the user may need to argue for scope they want.
- `ponytail` is session-persistent: a grill interrupted before handoff leaves it on for the rest of that session.
- Installing upstream `ponytail` too gives two skills with one name: keep one copy per harness.
