# Secrets lens

Does this branch leak a credential anywhere, now or in its history? This is a dedicated zoom: tools first, then judgement, because tools both miss and over-report.

## Tools

Run `gitleaks` or `trufflehog` when available, on the working tree and on the branch's commit range against its base. Not installed → say so in the review file and rely on the manual pass.

## Where to look

- Code: hardcoded keys, tokens, passwords, connection strings, private keys.
- Config: env files, YAML/JSON settings, Docker and compose files, CI workflows, IaC, Helm values.
- Fixtures: test data, snapshots, HTTP recordings (cassettes, HAR), seed data, notebooks with outputs.
- Logs and log statements: tokens, auth headers, cookies, full request bodies or PII being logged; committed log files.
- Docs and examples that copy real values.
- History: every commit on the branch. A secret added then removed is still leaked.

## Also

- Secrets in URLs or query strings, error messages, analytics or telemetry payloads.
- Server-only values exposed to client bundles through public env prefixes.
- Env and key files missing from `.gitignore`.

## Triage

Tell real credentials from placeholders and documented test keys: known prefixes (`AKIA`, `ghp_`, `sk-`, `xox`, `-----BEGIN ... PRIVATE KEY`), high entropy, context. Redact values in the finding.

Real secret in the tree or history → blocker with `needs-user` (rotate it; history rewrite is the user's call). Secret-bearing data logged or exposed → major. Missing ignore rule or a risky pattern without an actual leak → minor.
