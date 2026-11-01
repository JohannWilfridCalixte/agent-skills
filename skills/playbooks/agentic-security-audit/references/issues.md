# Issues

Publish format for agentic-security-audit step 4. Field names are `findings.json`'s.

## Items

- **Parent**: spec input for the whole fix effort. First line `Source: agentic-security-audit {work} run-{N}`. Goal: every confirmed finding remediated, each proven by a regression test. Scope, profile, run, coverage statement, children by severity. A **Needs validation** section: one entry per `needs_validation` record with its `blockers`; these are not children.
- **Child**, one per `confirmed` record, most severe first: spec input for one fix. Fingerprint (`fingerprint`), problem (`description`), severity (`severity.overall_severity`), evidence (`file:line`, from `trace` and `evidence`), root cause (`root_cause`), intended behaviour (`intended_behavior`), remediation strategy (`remediation.strategy`), suggested ACs: the exploit path is blocked; a regression test reproduces it and passes after the fix.

## Linking

- **local** → `{work}/audit/issues/index.md` (parent, linking each child by relative path) plus `{work}/audit/issues/NN-slug.md` per child.
- **github** → parent issue, then each child as a sub-issue via GraphQL `addSubIssue` (node ids from `gh issue view --json id`). Mutation unavailable → list the children as a task list (`- [ ] #N title`) in the parent body.
- **jira, linear, other** → its native parent-child link (Jira parent or epic, Linear sub-issue); none → the task-list fallback.

## Re-run, same destination

The parent and the children already logged (`issues` in `state.json`, by fingerprint) are updated in place; each fingerprint has one child.

A logged child this run settled without confirming (its fingerprint `rejected` in `findings.json`, or its `file:line` inside the `reviewed_paths` of a `covered` unit in `coverage-ledger.json`, with no `confirmed` record) → ask per child: close (local: a `Status: closed` line), or mark obsolete (title prefix `[obsolete]`, reason in the body); log each as `choice` `obsolete.{fingerprint}`. Children outside what this run covered stay untouched.
