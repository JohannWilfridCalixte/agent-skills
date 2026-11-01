---
name: agentic-pr-review
description: Review a pull request with every configured reviewer, then save the report or post it as a PR review. No fixes.
disable-model-invocation: true
argument-hint: "[<PR number | URL>]"
---

# PR Review

Playbook. One review pass on someone's PR; the code stays as it is.

1. Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it). PR: the one given, else the current branch's; none → ask. Log `started` with workflow `pr-review`. Done when `started` is logged and the PR number is known.
2. Call the Skill tool with "agentic-review" with the PR as scope (PR mode).
3. Log `completed` with the report path or the posted review link.

Done when `reviews/pr-report.md` exists or the review is posted on the PR.
