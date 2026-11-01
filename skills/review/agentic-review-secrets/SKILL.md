---
name: agentic-review-secrets
description: "Secrets review of a branch or diff, history included. Use to check a change for leaked keys, tokens or passwords before it ships."
---

# Review Secrets

Does this branch leak a credential anywhere, now or in its history? A dedicated zoom: tools first, then judgement, because tools both miss and over-report. Report-only.

Scope: the diff and commit range from the caller; standalone → the current branch against the default branch.

## 1. Tools

Run `gitleaks` or `trufflehog` when available, on the branch's commit range against its base and on tracked and staged files (`git ls-files`, `git diff --cached`). Untracked gitignored files (a local `.env`) are out of scope. Not installed → say so in the report and rely on the manual pass.

## 2. Manual pass

Every place below checked:

- Code: hardcoded keys, tokens, passwords, connection strings, private keys.
- Config: env files, YAML/JSON settings, Docker and compose files, CI workflows, IaC, Helm values.
- Fixtures: test data, snapshots, HTTP recordings (cassettes, HAR), seed data, notebooks with outputs.
- Logs and log statements: tokens, auth headers, cookies, full request bodies or PII being logged; committed log files.
- Docs and examples that copy real values.
- History: every commit on the branch. A secret added then removed is still leaked.
- Secrets in URLs or query strings, error messages, analytics or telemetry payloads.
- Server-only values exposed to client bundles through public env prefixes.
- Env and key files tracked, or untracked without an ignore rule.

## 3. Triage

Tell real credentials from placeholders and documented test keys: known prefixes (`AKIA`, `ghp_`, `sk-`, `xox`, `-----BEGIN ... PRIVATE KEY`), high entropy, context.

- Real secret in a tracked or staged file → blocker, fix = remove it (env var or secret store).
- Every real secret, in a file or only in history → a separate blocker needs-user finding: rotate it; history rewrite is the user's call.
- Secret-bearing data logged or exposed → major.
- Missing ignore rule or a risky pattern without an actual leak → minor.

## Report

Findings in agentic-review's finding contract ([../agentic-review/references/finding.md](../agentic-review/references/finding.md)), written to the path the caller gives; standalone → in the reply. Done when every tool result and every place in step 2 is either a finding or checked clean.
