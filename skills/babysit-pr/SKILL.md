---
name: babysit-pr
description: Push the branch, open the PR, then watch CI and review comments, fixing and replying in a loop until the PR is merge-ready. Never merges. Use after review, or when asked to open a PR, get a PR green, or handle PR feedback.
argument-hint: "[<work-item slug> | <PR number/url>]"
---

# Babysit PR

Get the PR to merge-ready and keep it there. Never merge.

Load `use-workflow` first. It owns config, step resolution, delegation, the work-item folder, the event log, limits and communication mode.

If the harness has a native PR loop (e.g. Cursor's `autopilot` skill), defer to it: pass the work-item paths and the authority rules below, and keep only the work item's log and `pr.md` up to date.

Use the platform's tooling: `gh`, or a Bitbucket / GitLab CLI or MCP, whichever is available. Same for the ticket tracker.

## Open

- Open escalations → stop unless the user overrides (logged by `use-workflow`).
- Tree committed and green. No review recorded for the work item → warn and suggest `review` first.
- Push the branch. Never force-push without asking.
- Reuse the branch's existing PR, or open one. Description: why (spec), what changed (plan tasks), review summary and remaining minors, how to verify, ticket links.
- Move the linked tickets to *In Review*. Record the PR in `pr.md`.

## Loop

Each round, up to `limits.babysit.rounds`:

1. Wait for CI and new reviewer activity. Poll with backoff, don't spin.
2. Triage everything new:
   - **CI failure**: read the logs. Real failure → fix. Likely flake → re-run once, then treat as real.
   - **Bot comment**: valid → fix; not valid → reply with the reason. Resolve either way.
   - **Human comment**: clear request → fix, reply with the commit link, resolve the thread. Debatable, design-level or disagreement → escalate to the user with a recommendation; don't answer on their behalf.
   - **Conflict with base**: resolve if mechanical, following the repo's merge or rebase convention; otherwise escalate.
3. Fix: group by disjoint files, one `babysit.fix` subagent per group, with the comment or log references, the work-item paths, the profile codestyle skills and `code-testing`. Each commits its fix and returns the sha.
4. Run the project checks, push, post the replies, log the round in `pr.md`.

## Stop

- CI green and no unresolved actionable thread → report merge-ready, with pending approvals if any.
- Escalation, red tree you can't fix, or rounds exhausted → stop and ask, with what is left and a recommendation.
