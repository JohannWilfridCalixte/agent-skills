---
name: claude-security-review
description: "Security review of a branch or diff with Anthropic's claude-code-security-review prompt, unmodified. Use to check a change for exploitable vulnerabilities before it ships."
---

# Claude Security Review

Anthropic's security-review prompt, vendored as one file in [upstream/security-review.md](upstream/security-review.md), run against the caller's diff. Report-only.

Scope: the diff and commit range from the caller; standalone → the current branch against the default branch.

## 1. Collect

The prompt's `!`-backtick commands don't run on their own. Run these in their place, on the committed range only; `git status` and the working tree are out of scope:

- files modified: `git diff --name-only <base>...HEAD`
- commits: `git log --no-decorate <base>..HEAD`
- diff content: `git diff <base>...HEAD`

Done when the diff is non-empty and every output is in hand.

## 2. Review

Read `upstream/security-review.md` and follow it from OBJECTIVE to the end, on the output of step 1, with these overrides:

- **Filter**: keep its per-finding false-positive pass (FALSE POSITIVE FILTERING) and drop every finding scored below 8. No subagent tool → run the pass inline, one finding at a time.
- **Output**: its markdown report format and its "nothing else" reply are replaced by the Report below. Its "do not write to any files" binds the filter pass only.

Done when every finding from the vulnerability pass has a confidence score and every survivor scores 8 or more.

## Report

Findings in agentic-review's finding contract ([../agentic-review/references/finding.md](../agentic-review/references/finding.md)), written to the path the caller gives; standalone → in the reply. Severity translated by its row there; `rule` = the prompt's category plus a CWE id; `evidence` carries the exploit scenario and the confidence score. Done when every surviving finding is written and the report says how many the filter dropped.
