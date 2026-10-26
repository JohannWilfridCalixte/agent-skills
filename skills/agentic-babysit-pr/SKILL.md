---
name: agentic-babysit-pr
description: Push the branch, open the PR, then watch CI and review comments, fixing and replying in a loop until the PR is merge-ready, and keep watching until it is merged, then hand off to agentic-cleanup. Never merges. Use after agentic-review, or when asked to open a PR, get a PR green, handle PR feedback, or watch a PR until it merges.
argument-hint: "[<work-item slug> | <PR number/url>]"
---

# Babysit PR

Get the PR to merge-ready, keep it there until it merges, then clean up. Never merge.

Load `agentic-use-workflow` first. It owns config, step resolution, delegation, the work-item folder, the workspace, the event log, limits and communication mode. Every git and code operation runs in `workspace.path`.

If the harness has a native PR or polling loop (e.g. Cursor's `autopilot` or `loop` skills), defer the watching to it: pass the work-item paths, the workspace path, the authority rules below and the merge → `agentic-cleanup` hand-off, and keep only the work item's log and `pr.md` up to date.

Use the platform's tooling: `gh`, or a Bitbucket / GitLab CLI or MCP, whichever is available. Same for the ticket tracker.

## Open

- Open escalations → stop unless the user overrides (logged by `agentic-use-workflow`).
- Tree committed and green. No review recorded for the work item → warn and suggest `agentic-review` first.
- Push the branch. Never force-push without asking.
- Reuse the branch's existing PR, or open one against `workspace.base`. Description: why (spec), what changed (plan tasks), review summary and remaining minors, how to verify, ticket links.
- Move the linked tickets to *In Review*. Record the PR in `pr.md`.

## Loop

Repeat until the PR is merged or closed. Rounds that push fixes are capped by `limits.babysit.rounds`; watching isn't.

1. Wait for CI, new reviewer activity, and the PR state. Poll with backoff, don't spin. Once merge-ready, back off further (minutes, then tens of minutes).
2. Triage everything new:
   - **CI failure**: read the logs. Real failure → fix. Likely flake → re-run once, then treat as real.
   - **Bot comment**: valid → fix; not valid → reply with the reason. Resolve either way.
   - **Human comment**: clear request → fix, reply with the commit link, resolve the thread. Debatable, design-level or disagreement → escalate to the user with a recommendation; don't answer on their behalf.
   - **Conflict with base**: resolve if mechanical, following the repo's merge or rebase convention; otherwise escalate.
3. Fix: group by disjoint files, one `babysit.fix` subagent per group, with the comment or log references, the work-item and workspace paths, the codestyle skills and `agentic-code-testing`. Each commits its fix and returns the sha.
4. Run the project checks, push, post the replies, log the round in `pr.md`.

CI green and no unresolved actionable thread → report merge-ready once (with pending approvals if any), log it, keep watching.

## Stop

- **Merged or closed** → log `babysit-pr` completed. Standalone → run `agentic-cleanup {slug}` (it asks before cleaning a PR closed without merge). Under `agentic-ship-feature` → return.
- Escalation, red tree you can't fix, or fix rounds exhausted → stop and ask, with what is left and a recommendation.
- Session ending before the merge → say that `agentic-babysit-pr {slug}` resumes watching, or `agentic-cleanup {slug}` cleans up once merged.
