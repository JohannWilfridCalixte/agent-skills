# Step 3: Report and Deliver

Build `review-report.md` using [the report template](../references/review-report.md) and common findings policy. Include exact repository/PR/base/head, readiness, deduplicated counts, coverage and limitations. Complete coverage with any blocker or major maps to `REQUEST_CHANGES`; complete with neither maps to `APPROVE`; incomplete maps to an explicitly incomplete `COMMENT`. The report's factual readiness stays separate from whether GitHub permits the event.

Before final delivery, re-fetch current base/head with explicit `--repo`. Changed target invalidates the old review for current readiness. Preserve its report and archive superseded active receipts in `history.review_loops` (and related gates/checks) with reason/candidate; create current pending review prerequisites before replacing them. Current missing or failing evidence stays active. Refresh immutable inputs/context and rerun the one-pass review for the new target. Allow one automatic refresh per PR per invocation; if it moves again, report blocked/stale evidence and require a stable target instead of looping indefinitely. Never post stale inline comments or claim the old review covers new code.

## Local mode

Save the report and show readiness, counts, top three actionable findings, material limitations and absolute path. No GitHub writes. Parent collects batch results in a table keyed by full repository/PR/head, including incomplete/blocked items; equal PR numbers in different repositories remain distinct.

## Authorized PR-comments mode

Prepare the exact overall body and inline comments locally first. Parent alone publishes; existing explicit posting authorization applies to this reviewed scope. Save the local report before any remote call.

Use stable markers keyed by repository, PR, reviewed base/head and item: `<!-- agentic-review:<repo>:<pr>:<base>:<head>:overall -->` and `<!-- agentic-review:<repo>:<pr>:<base>:<head>:<finding-id> -->`. Parent stores each action under the scope's publication map with marker, prepared payload path, status (`prepared | posted | failed`), remote ID/URL and error. Before every create/retry, enumerate existing reviews/comments across all pages and reconcile the exact marker. One existing match is reused; multiple matches block that item; uncertain lookup is not proof of absence. Persist each success separately and retry only unresolved items after a partial failure.

Post overall review with explicit routing, for example `gh pr review <number> --repo <repo> --request-changes --body-file <prepared-body>`, selecting the event from readiness. For blocker/major inline findings with valid anchors, verify current diff path, side and line against the immutable reviewed patch. Use the repository-qualified API endpoint and recorded head as commit_id. Unanchorable findings stay in the overall report rather than being attached to guessed lines.

Recheck base/head immediately before each publication batch; on movement return to refresh. API rejection/self-review restrictions are recorded honestly: do not claim APPROVE/REQUEST_CHANGES was posted when rejected. An authorized comment may communicate the unchanged readiness plus the platform limitation; record actual event and coverage separately. Required unresolved publication leaves delivery blocked, with prior successes/local reports retained.

## Completion and knowledge

Through `use-knowledge`, reconcile significant supported discoveries without treating proposed PR behavior as already shipped. Parent records per-PR review outcome, delivery result and artifacts. Complete only when all requested reviews and chosen deliveries finish; a fully delivered report can contain changes_requested findings, but incomplete analysis or failed required posting remains explicitly blocked/incomplete rather than clean. Set completed_at only on completed. Batch summary reports each outcome, not a fabricated aggregate approval.
