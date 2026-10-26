---
name: agentic-cleanup
description: Clean up after a merged PR. Removes the work item's worktree, deletes its local and remote branch, puts the main checkout back on an up-to-date default branch, and archives the work-item folder. With --all, sweeps every merged work item and reports what was cleaned and what was skipped. Never deletes unmerged, uncommitted or unpushed work without asking. Use when a PR has merged, when agentic-babysit-pr sees the merge, or to tidy up stale worktrees and branches.
argument-hint: "[<slug> | --all]"
---

# Cleanup

Remove everything a merged work item left behind, keep its audit trail.

Load `agentic-use-workflow` first. It owns config, the work-item folder, the workspace, the event log and communication mode. Run git from the main checkout. Read PR state with the platform's tooling: `gh`, or a Bitbucket / GitLab CLI or MCP.

## Target

- Slug → that work item. No argument → the work item whose `workspace` matches the current branch or worktree; none → ask.
- `--all` → every non-archived work item in `{output}` that has a PR or a branch.
- Already in `{output}/_archive/` → say so, stop.
- No `workspace` recorded → use the PR's head branch.

## Merged?

- PR merged → clean. Authoritative, covers squash merges.
- No PR → clean only if the branch is merged into the up-to-date default branch.
- PR closed without merge → ask whether to clean. Yes covers deleting that unmerged branch.
- Otherwise → skip, say why.

## Clean

Never delete the default branch. Uncommitted changes or commits not on the remote, in the worktree or on the branch → ask, never discard. Each step is skipped when already done:

1. Main checkout on the work item's branch → switch to the default branch. Dirty → ask.
2. Update the default branch (fast-forward pull).
3. `kind: worktree` → `git worktree remove {path}`, then `git worktree prune`.
4. Delete the local branch. `git branch -d` refuses squash-merged branches: force only when the PR state confirms the merge.
5. Delete the remote branch if the platform hasn't already.

Log `cleanup` started, a `note` with the merge evidence (PR url and state, or merge commit) and what was removed, then `completed`: status becomes `archived`. Last, move the folder to `{output}/_archive/{work-item}/`. Nothing is written to it after the move; never delete it.

## --all

Same rules per work item, without stopping on the first question: clean the merged and safe ones, skip anything that needs an answer. Report two lists: cleaned, and skipped with the reason (not merged, PR open, closed without merge, uncommitted or unpushed work, dirty main checkout). Then offer to go through the skipped ones that only need a yes.
