# Findings and review results

The orchestrator supplies this contract as an explicit input to every lens. It owns aggregation and shared state. A standalone lens need not load the review-loop skill. Each lens returns its human-readable Markdown report and a JSON sibling:

```json
{
  "schema_version": 1,
  "scope_id": "org/repo#10@head-sha",
  "revision": "immutable-snapshot-digest-or-head-sha",
  "review_skill": "review-code",
  "status": "complete",
  "coverage": {"inspected": ["src/example.ts"], "not_inspected": [], "limitations": []},
  "findings": [
    {
      "id": "F-001",
      "severity": "major",
      "title": "Boundary case violates AC-01",
      "description": "Describe the concrete trigger and observed consequence.",
      "file": "src/example.ts",
      "line": 12,
      "side": "RIGHT",
      "evidence": "Exact code/test evidence at the reviewed revision.",
      "impact": "User-visible or engineering consequence and severity rationale.",
      "remediation": "Specific corrective action.",
      "confidence": "high",
      "requirements": ["AC-01"]
    }
  ]
}
```

`status` is `complete | incomplete`; severity is `blocker | major | minor | nit`; confidence is `high | medium | low`. `line` and `side` may be null when no precise changed-line anchor exists. `side` otherwise is `LEFT | RIGHT`. Paths are repository-relative. Requirement IDs must exist in the supplied plan; use an empty array when no plan applies. A missing required lens, unread affected code, stale snapshot, or material unavailable context makes coverage incomplete. Record limitations; absence of findings alone is never proof of coverage.

Use stable finding IDs within the scope; carry IDs across rounds when the same defect persists. Findings need concrete evidence and impact. A suspected issue without sufficient evidence belongs in limitations/open questions, not an invented blocking defect. Distinguish accepted-requirement compliance from general quality. Existing conventions inform a review but do not override explicit task requirements. Style preferences remain nits.

## Aggregation and readiness

Match duplicate findings by root cause, location and trigger, not title alone. Merge their evidence and requirement links, retain the highest justified severity, record source finding IDs, and count the merged finding once. Independent defects remain separate. Resolve incompatible remediation proposals against accepted requirements before dispatching repairs; unresolved contradictions make the repair result `blocked`.

Readiness has one policy:

| Condition | `readiness` | GitHub event when permitted |
|---|---|---|
| Any required review/coverage is incomplete | `incomplete` | `COMMENT`, explicitly incomplete |
| Complete, any blocker or major remains | `changes_requested` | `REQUEST_CHANGES` |
| Complete, zero blockers and majors | `pass` | `APPROVE` |

Self-review or host restrictions can prevent an event. Record the restriction and actual publication result; never claim an approval was posted or alter readiness to manufacture a pass. A known blocking finding remains visible even when incomplete coverage takes precedence.

## Parent-owned result

Store under `review_loops[scope_id]` (literal JSON key, with no dot-path parsing):

```json
{
  "mode": "report",
  "max_rounds": 1,
  "round": 1,
  "status": "reported",
  "readiness": "changes_requested",
  "target": {},
  "rounds": [
    {"round": 1, "revision": "snapshot-digest", "blockers": 0, "majors": 1, "minors": 0, "nits": 0, "readiness": "changes_requested", "reports": []}
  ],
  "findings": [],
  "unresolved": [],
  "completed_at": "ISO-8601"
}
```

Replace example values with observed evidence; `target` contains the full immutable call target, `reports` the returned report paths, `findings` deduplicated current findings, and `unresolved` limitations or blocked actions. Terminal statuses: report mode `reported`; repair mode `passed | max_reached | blocked`. A parent may record `in_progress` while collecting results. Report mode always ends after its single requested pass, including incomplete reports. Repair mode cannot return `passed` with incomplete coverage or an unresolved blocker/major. A changed target invalidates prior evidence; preserve old rounds as history, re-review the new target within the remaining budget or return `max_reached`.

Only the parent persists this result using the shared state contract. Review workers own only their unique report files. Fix workers own only granted source paths. Neither can mark the parent workflow completed.
