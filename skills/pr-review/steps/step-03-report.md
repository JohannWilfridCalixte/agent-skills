# Step 3: Report

## Intent

Aggregate findings from the review loop, determine verdict, deliver in the user's chosen output mode.

## Verdict

Derive verdict from finding severity counts:

| Condition | Verdict |
|-----------|---------|
| Any blockers | `REQUEST_CHANGES` |
| No blockers, any majors | `COMMENT` |
| 0 blockers, 0 majors | `APPROVE` |

## Build Report

Produce `{output_path}/review-report.md` following the template in `references/review-report.md`. Group findings by file where applicable.

## Deliver

### Local Mode

1. Save report to `{output_path}/review-report.md`
2. Display concise summary in chat: verdict, finding counts by severity, top 3 findings, path to full report

### PR Comments Mode

1. Always save local report first (same as local mode)
2. Post overall review: `gh pr review {pr_number} --approve|--request-changes|--comment --body "..."`
3. For each blocker and major with a specific file:line, post inline comment via `gh api repos/{repo}/pulls/{pr_number}/comments` — use `head_commit_sha` from workflow state
4. Display confirmation in chat: verdict, counts, number of inline comments posted

## Batch Collect

When running as a batch subagent, the parent orchestrator collects per-PR results after all subagents complete and displays a summary table:

```
| PR | Verdict | Blockers | Majors | Minors | Nits |
|----|---------|----------|--------|--------|------|
```

## Update State

```yaml
status: completed
completed_at: "{ISO}"
verdict: "{APPROVE | REQUEST_CHANGES | COMMENT}"
artifacts:
  review_report: "{output_path}/review-report.md"
```
