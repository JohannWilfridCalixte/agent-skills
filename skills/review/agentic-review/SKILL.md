---
name: agentic-review
description: Review a branch with every configured reviewer, fixing blockers and majors until clean; a pull request gets one report-only pass. Use after implementation, or to review a PR.
argument-hint: "[<slug> | <PR number/url> | <base ref>] [--only <reviewer,reviewer>]"
---

# Review

Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it) unless already loaded.

## 1. Scope

- Slug → `workspace.branch` against `workspace.base`, in `workspace.path`.
- No slug → the current branch against the given base ref or the default branch, as a new work item.
- PR number or URL → PR mode (below).
- Reviewers = `bun {agentic-use-workflow}/scripts/agentic.ts review eligible --base <base> [--iteration n] [--only a,b]` (`--only` adds on-demand reviewers). A reviewer not reachable → warn, record it `skipped` for the summary, continue with the rest.
- Spec sources: `spec.md`, `plan.md`, tickets; none → PR description, ticket links, commit messages.
- Standards: the codestyle union (agentic-use-workflow Config, Profiles) as skills; `{knowledge.root}/tech/principles.md` and ADRs as paths.
- Diff command `git diff <base>...HEAD`, commit list `git log <base>..HEAD --oneline`. Confirm the base resolves and the diff is non-empty.

Done when every reviewer is reachable or recorded skipped, and the diff, spec sources and standards are pinned.

## 2. Reviewers

Iteration `n` starts at 1, or after the latest `reviews/{n}-*.md` on resume. `n` > 1 → pass `--iteration n` to `review eligible`.

One subagent per reachable reviewer, all in parallel, step key `review.<reviewer>`, agent label `review.<reviewer>-{n}`, resolved model and effort. Brief per agentic-use-workflow `references/delegation.md` (`Skills:` copied verbatim):

- `Load skills:` `<reviewer>`, then the codestyle union. Goal: follow `<reviewer>` on this diff.
- `Read:` diff command, commit list, spec sources, principles and ADR paths, this run's reviewer list, previous iteration's review and fix list when present (keep carried ids, judge disputed findings). PR mode adds the PR number and URL.
- **Report-only**: the one write is `reviews/{n}-<reviewer>.md`, per [references/report.md](references/report.md) and [references/finding.md](references/finding.md) (absolute paths). Code, commits, PR, board and merge stay untouched.
- Adjustments for third-party reviewers:
  - `code-review`: fixed point = base, spec = `spec.md`, else `plan.md` (light mode: its acceptance criteria), the tracker is the work item's tickets. Nested subagents unavailable → run both axes inline.
  - `super-review`: `Load skills:` adds `codebase-design`; follow [references/super-review.md](references/super-review.md) (absolute path): replaces its board, PR and merge steps and unvendored links.
  - `pr-security-review`: its context comes from the brief's diff command and commit list, file list `git diff --name-only <base>...HEAD`, in place of its `git fetch`, `git status` and `origin/<base>` commands: committed range only.
  - `ub-mode`: its principles are the standard to judge the diff against; its Practice section is out of scope.
- Return counts per severity (report.md).

Done when every reachable reviewer's file exists and its counts are logged.

## 3. Fix loop

1. Aggregate and dedupe: same location and issue across reviewers → keep the highest severity.
2. Set needs-user findings aside for section 4.
3. No blocker or major left → section 4.
4. Write the blockers and majors to `reviews/{n}-fix.md` (Fix list in [references/finding.md](references/finding.md)), then call the Skill tool with "agentic-implement", passing that path; one fix pass per iteration, never a raw `Agent`.
5. `n` + 1, run section 2 with `review eligible --iteration n`: only reviewers that had findings re-run. When the fix can break the others, the orchestrator may widen with `--all --reason <why>` (logged as a `note`).

Minors and nits are reported, not looped on. Commits pushed after the PR opens get a re-review: section 2 again on the new range, same iteration rule. At `limits.review.iterations` with blockers or majors left → a `review.{n}` choice already logged stands; else ask: another round, accept with the remaining findings, or stop. Log the answer as a `choice`, key `review.{n}`, value `another`, `accept` or `stop`. `stop` → Done, needs-user findings listed as open.

Done when no blocker or major is left, or `review.{n}` is `accept`.

## 4. Needs-user

Ask every needs-user finding of the run (deduped by id) in one question: id, severity, location, the `needs-user` action. Per finding the user answers `done` (acted) or `accepted` (risk taken, no action). Log each as a `choice`, key `needs-user.{id}`, value `done` or `accepted`; one already logged stands.

Done when every needs-user finding has a choice; none → done at once.

## PR mode

One pass, no fix loop, code untouched. In order:

1. **Output**: ask local (`reviews/pr-report.md`, nothing posted) or post (one PR review). Log the answer as a `choice`, key `review.output`, value `local` or `post`. Posting needs `post`.
2. **Fetch**: PR number, URL, base, head, description and comments, with the platform's tooling (`gh`, or a Bitbucket / GitLab CLI or MCP). `<base>` = `origin/<PR base branch>`, fetched.
3. **Checkout**: the work item's `workspace` when it is at the PR head; else a `worktree` workspace per agentic-use-workflow Workspace, checked out at the PR head (`gh pr checkout` or the platform's equivalent) instead of a new branch, logged as a `decision`.
4. **Review**: section 2 once, next `n`.
5. **Verdict**: any blocker → request changes; else any major or needs-user finding → comment; else approve (comment when the platform forbids approving).
6. **Report**:
   - Local: verdict, counts, skipped reviewers and every finding, needs-user findings under their own heading.
   - Post: security findings (rule an OWASP / CWE id, or from `claude-security-review`, `pr-security-review`, `agentic-review-secrets`, `agentic-review-access-control`) go through agentic-use-workflow `references/disclosure.md` first, destination = the PR's repo; not confirmed → they stay in a local `reviews/pr-report.md`, the rest is posted. Then one review: summary as body, one inline comment per blocker and major on the head commit, minors, nits and needs-user findings batched in the body.

Done when the report exists or the review is posted.

## Done

Sections 3 and 4 done, the user stopped, or PR mode reported. Return to the caller a summary per reviewer: counts, fixed, remaining, skipped reviewers, needs-user findings with their answers.
