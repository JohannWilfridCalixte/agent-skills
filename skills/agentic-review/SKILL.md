---
name: agentic-review
description: Review a change through six parallel lenses (spec, codestyle, tests, security, access-control, secrets), then fix blockers and majors in a loop until clean. PR mode posts the findings as PR comments instead of fixing. Use after agentic-implement, on any branch or diff, or to review a pull request.
argument-hint: "[<work-item slug> | <PR number/url> | <base ref>] [--only <lens,lens>]"
---

# Review

Load `agentic-use-workflow` first. It owns config, step resolution, delegation, the work-item folder, the event log, limits and communication mode.

## Scope

- Slug → `workspace.branch` against `workspace.base`, run in `workspace.path` (`agentic-use-workflow`); `spec.md` and `plan.md` are the reference.
- No slug → the current branch (or given base ref) as a new work item; the spec lens falls back to PR description, tickets and commit messages.
- PR number or URL → PR mode.
- `--only spec,security` → run that subset. Default: all six.

## Lenses

One subagent per lens, all in parallel, step key `review.<lens>`. Give each: its lens file `reviewers/<lens>.md`, `references/finding.md`, the diff range, the workspace path, the work-item paths (spec, plan, implementation, previous reviews) and the profile codestyle skills. Each writes `reviews/{iteration}-{lens}.md` and returns its counts.

| Lens | Checks against |
|---|---|
| `spec` | acceptance criteria in `spec.md` / `plan.md` |
| `codestyle` | `docs/tech/principles.md`, ADRs, profile codestyle skills |
| `tests` | `agentic-code-testing` |
| `security` | OWASP Top 10 |
| `access-control` | authz on every entry point, IDOR, tenant isolation |
| `secrets` | credential leaks in code, config, logs, fixtures, branch history |

## Fix loop

Aggregate and dedupe (same location and issue across lenses → keep the highest severity). No blocker or major → done.

Otherwise group blockers and majors by disjoint files and run one `review.fix` subagent per group in parallel, with the findings, the work-item paths, the profile codestyle skills and `agentic-code-testing`. Each fixes, runs the checks, makes one commit referencing the finding ids, and reports each finding as fixed or disputed with a reason. Findings that need a user action (rotating a leaked credential, rewriting history, a design call) are escalated, not attempted.

Run the project checks, then re-run all selected lenses: a fix for one lens can break another. They judge disputed findings too. Minors and nits are reported, not looped on.

Stop at `limits.review.iterations` with blockers or majors left → ask: another round, accept with the remaining findings (logged), or stop.

## PR mode

Fetch the PR metadata and diff with the platform's tooling (`gh`, or a Bitbucket / GitLab CLI or MCP). Read code at the PR head without disturbing the user's working tree. Run the lenses once, no fixes.

Before reviewing, ask the output: **local** (report in `reviews/pr-report.md`, nothing posted) or **post** (PR review on the platform).

Verdict: any blocker → request changes; majors only → comment; clean → approve (comment instead if the platform forbids approving).

- Local: write the verdict, counts and all findings to the report.
- Post: one review, the summary as body, one inline comment per blocker and major on the head commit, minors and nits batched in the body.

## Done

Summarize per lens: counts, what was fixed, what remains. That summary feeds `agentic-babysit-pr`.
