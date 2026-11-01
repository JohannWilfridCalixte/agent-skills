# 0004 - Security audit playbook and claude-security-review reviewer

**Status:** Accepted
**Date:** 2026-11-01
**Supersedes (partially):** [0002](0002-skill-composition.md): `pr-security-review` in the default reviewers, vendoring limited to skill folders

## Context

Security had one diff-level reviewer, `pr-security-review`: Anthropic's security-review prompt as ported by super-board, with super-board's own edits. No playbook audited a whole repo, and no flow turned audit findings into fixable work.

Anthropic's `claude-code-security-review` ships the original prompt as a command (`.claude/commands/security-review.md`) and as a GitHub Action. There's no `SKILL.md` upstream, so `npx skills add` can't vendor it. The Action runs only in CI and needs an Anthropic API key. Cloudflare's `security-audit-skill` is a full skill: a six-phase source-first audit with independent verification and machine-readable findings.

## Decision

### Reviewer swap

New agentic reviewer `claude-security-review`, which is report-only and model-invoked. It reads the vendored prompt and follows it, with these overrides:

- It replaces the prompt's `!`-backtick git commands with agentic-review's committed range: `git diff <base>...HEAD`, its `--name-only`, `git log <base>..HEAD`. No working-tree status or diff.
- It writes findings in the finding contract and maps HIGH/MEDIUM/LOW to blocker/major/minor.
- It keeps the per-finding false-positive filter and the confidence ≥ 8 cutoff. When no subagent tool is available, the filter runs inline.

It replaces `pr-security-review` in the default `reviewers`. `pr-security-review` stays vendored and opt-in.

### Single-file vendoring

A `vendor.json` entry `{source, name, file, into}` fetches one upstream file plus `LICENSE` into `into`. The lock records `sourceType: "file"`. `update` wipes `into`, so the wrapper `SKILL.md` sits one level above (`claude-security-review/upstream/security-review.md`). `verify` hashes only the vendored file.

### Audit playbook

`agentic-security-audit` is user-invoked, has workflow id `security-audit`, and runs the steps `start`, `audit`, `report`, `publish`. It audits in passes: each pass is one security-audit run `run-{N}`, and a work item whose status is `done` can start a new pass.

- **Start**: one exchange that asks for scope (whole repo or paths), profile (`quick` / `standard` / `deep`), output dir and destination. A new pass asks again, with the prior pass's answers as defaults. Answers are logged as dotted per-pass keys (`profile.run-{N}`), which the playbook reuses when an in-flight pass resumes. The first pass reads knowledge into `context.md` and records the workspace as `current`, with no worktree, because the audit never writes to the repo.
- **Audit**: vendored `security-audit` in full audit mode.
  - Output defaults to `{output}/{work}/audit/run-{N}/`. That's inside the target, so upstream allows it only when the user explicitly selects it and git ignores it. Start shows the real path and asks for confirmation, then `git check-ignore` verifies it, suggesting the `.gitignore` line if needed. A dir outside the repo also works.
  - Earlier runs that reached upstream's terminal state (`run_status` `complete` or `incomplete`) are fed in as prior runs.
  - On resume, an unfinished run is continued or discarded, at the user's choice.
  - Agents run on the new step key `audit`, frontier / high.
- **Report**: an interactive review of the counts by verdict and severity, the top confirmed findings and the coverage statement. It ends with publish or stop, logged as a `choice`, not a `gate`, since `gate` belongs to the escalation gate.
- **Publish**: one parent plus one child per `confirmed` finding, locally (`{work}/audit/issues/`), on GitHub, or on another tracker.
  - Each child is spec input: problem, evidence, root cause, intended behaviour, remediation strategy, and ACs (exploit path blocked, proven by a regression test).
  - The parent is spec input for the whole fix effort, with `needs_validation` records in their own section, not as children.
  - GitHub children link as sub-issues (GraphQL `addSubIssue`), falling back to a task list in the parent.
  - The result is an `issues` artifact (`{parent, children}`), never `tickets`, so `agentic-implement` never takes the findings as units.
  - On a re-run the items are updated rather than duplicated. For each child with no confirmed record in the new run, the user chooses whether to close it or mark it obsolete.

### Disclosure guard

The guard is defined once, in `agentic-use-workflow`, and runs before unfixed vulnerabilities are posted anywhere other than local files.

- **GitHub**: the visibility of the destination repo, which is named explicitly.
- **Jira, Linear and other trackers**: the user is asked whether the destination is private.

If the destination is public, or its visibility is unknown, the skill warns, recommends local or a private destination, and posts only on an explicit confirm, logged as a `choice`. The audit playbook applies the guard before publishing, and `agentic-to-tickets` applies it when its input is an audit parent (that parent's `Source:` line).

### Fix path

`agentic-change-feature <parent ref | issues/index.md>` in full mode with tickets: the fixes change existing behaviour, so the spec records it first.

- `agentic-to-spec` captures the parent together with every child: sub-issues, task-list items and local links.
- `agentic-to-tickets` maps its slices onto the existing children instead of creating duplicates.
  - Tracker children are updated in place.
  - Local children are copied into the new work item's `tickets/` with a `Source:` line. A skill never writes into another work item. `agentic-to-plan`'s light branch is now keyed on `diagnosis.md` instead of the caller's name, so any playbook can take it.

## Rationale

- The upstream prompt, unedited, is the reference security review. Wrapping it keeps its behaviour while agentic owns the base, the output and the severity mapping.
- Vendoring the file keeps the byte-identical, hash-verified guarantee, and it runs in every harness without CI or an API key.
- A full audit and a diff review answer different questions. The audit belongs in a playbook with its own gate, while the diff review stays in the review loop.
- One child per confirmed finding gives each fix its own ticket, acceptance criteria and regression test. The parent lets one spec cover the whole effort.
- Disclosure is irreversible, so the user decides it explicitly, for every kind of tracker.

## Alternatives Considered

- **Keep `pr-security-review` as default**: rejected. It's a modified port, and the original is available.
- **Use the GitHub Action**: rejected. It's CI-only, needs an API key, and stays out of the local fix loop.
- **Vendor the prompt into the wrapper's own folder**: rejected. `update` wipes `into`, which would delete the wrapper.
- **Audit output in `~/security-audit-skill/`** (upstream default): rejected. It sits outside the work item, so it isn't resumable from the slug or archived with the run.
- **Children for `needs_validation` findings**: rejected. They're unproven, so they would turn into tickets for work that may be unneeded.
- **Fix inside the audit playbook**: rejected. Fixing is a feature-sized effort that needs its own spec, plan and tickets.

## Consequences

- The default security review changes for every project that doesn't set `reviewers`.
- `security-audit` is heavy: a `deep` run on a large repo launches many `audit` agents. Its budget rules apply.
- Audit runs accumulate under the work item until cleanup archives it, and they're never committed while `{output}` stays git-ignored.
- On a public repo, a local or private tracker is the safe default. The user can still override it.
- Single-file vendoring is now a general mechanism for prompt-only upstreams.
