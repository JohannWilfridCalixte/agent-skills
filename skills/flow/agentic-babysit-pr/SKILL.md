---
name: agentic-babysit-pr
description: "Get a work item's PR merge-ready and watch it until it merges: push, open or reuse the PR, fix CI and comments in a loop. Use to open a PR, get it green, handle feedback, or watch it to merge."
argument-hint: "[<slug> | <PR number/url>]"
---

# Babysit PR

Get the PR to merge-ready, keep it there until it merges, then clean up when standalone (under a playbook, `agentic-use-workflow` `references/playbook.md` runs cleanup). Never merge.

Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it) unless already loaded.

If the harness has a native PR or polling loop (e.g. Cursor's built-in `babysit` skill, Claude Code's `/loop`), defer the watching to it: pass the work-item paths, the workspace path, Loop step 2's triage rules, the merge-ready report, the Stop rules and the merge → `agentic-cleanup` hand-off, and keep only the work item's log and `pr.md` up to date.

Use the platform's tooling: `gh`, or a Bitbucket / GitLab CLI or MCP, whichever is available. Same for the ticket tracker.

## Open

- Open escalations → agentic-use-workflow references/state.md Resume step 0.
- Uncommitted changes or red checks in `workspace.path` → stop and report what is dirty or failing.
- No review recorded for the work item (no `reviews/` files) → warn, suggest `agentic-review` first, continue on the user's yes.
- Push the branch. Force-push only after the user's yes.
- Reuse the branch's existing PR, or open one against `workspace.base`. Description: why (spec), what changed (plan tasks or tickets), review summary and remaining minors, how to verify, ticket links.
- Move the linked tickets to *In Review*. Record the PR in `pr.md` and log an `artifact` event, `data: {name: "pr", path: "pr.md", pr: {url, round: 0}}`.

Done when the branch is pushed, the PR is open, and its `artifact` event is logged.

## Loop

Repeat until the PR is merged or closed. Rounds that push fixes are capped by `limits.babysit.rounds`; watching isn't.

1. Wait for CI, new reviewer activity, and the PR state. Poll with backoff. Once merge-ready, back off further (minutes, then tens of minutes).
2. Triage everything new:
   - **CI failure**: read the logs. Real failure → fix. Likely flake → re-run once, then treat as real.
   - **Bot comment**: valid → fix; not valid → reply with the reason. Resolve either way.
   - **Human comment**: clear request → fix. Debatable, design-level or disagreement → ask the user, with a recommendation; log the answer as a `choice`, key `pr.{round}.{thread}`, then fix or reply per the answer.
   - **Conflict with base**: resolve if mechanical, following the repo's merge or rebase convention; otherwise ask the user, log the answer as a `choice`, key `pr.{round}.conflict`.
3. Fix, when step 2 found any:
   1. Write `reviews/{n}-fix.md` (next free iteration `n`), one finding per CI failure or actionable comment, reviewer `ci` or `pr-comment`, evidence = log excerpt or comment link (Fix list in agentic-review's finding contract: `references/finding.md` in the agentic-review skill).
   2. Call the Skill tool with "agentic-implement", passing that path.
   3. Call the Skill tool with "agentic-review" on the work item: its loop re-reviews the fixes.
4. Push, reply to each fixed comment with its commit link and resolve the thread, log the round in `pr.md` and as an `artifact` event, `data: {name: "pr", path: "pr.md", pr: {url, round}}`.

CI green and no unresolved actionable thread → merge-ready: report once, log it as a `note` event, keep watching. The report: PR link, pending approvals, tickets, artifacts, remaining minors, open escalations, plus any lines the caller passed (e.g. the root cause from `agentic-debug`).

## Stop

- **Merged or closed** → log `babysit-pr` completed. Under a playbook → return. Standalone → Call the Skill tool with "agentic-cleanup" for the slug (it asks before cleaning a PR closed without merge).
- Red tree you can't fix, or fix rounds exhausted → stop and ask, with what is left and a recommendation.
- Session ending before the merge → give the resume command per `agentic-use-workflow` `references/state.md` Resume (the playbook's under a playbook), and `agentic-cleanup {slug}` for once it is merged.
