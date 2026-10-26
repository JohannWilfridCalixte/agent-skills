# Finding contract

Each lens writes `reviews/{iteration}-{lens}.md`: a first line `verdict: pass | changes-requested` with counts per severity, any lens-specific matrix, then one block per finding, most severe first. No findings → say so.

```markdown
### {lens}-{n}: {short title}

- **severity**: blocker | major | minor | nit
- **lens**: spec | codestyle | tests | security | access-control | secrets
- **location**: `path:line` or `path:start-end` (`commit:<sha> path` for history)
- **rule**: what is violated: acceptance criterion, principle or ADR, skill rule, OWASP / CWE id
- **evidence**: the code or behaviour that shows it, quoted briefly
- **fix**: concrete suggested fix
- **needs-user**: only when the fix requires a human action (rotate a credential, rewrite history, design call)
```

## Severity

| Severity | Meaning | Blocks |
|---|---|---|
| blocker | Wrong behaviour, data loss, exploitable vulnerability, missing authz, leaked secret, test that proves nothing | yes |
| major | Missing acceptance criterion or edge case on a critical path, weak validation, fragile test strategy, consequential principle violation | yes |
| minor | Suboptimal but safe: low-risk edge case, readability, defense in depth | no |
| nit | Cosmetic or preference | no |

## Rules

- One issue per finding. Point at the line, not the file.
- Stay on the change. Pre-existing issues only if the change makes them worse or they are security blockers; prefix the title with `pre-existing:`.
- Keep the id of a finding carried over from a previous iteration.
- Never paste a secret value: redact everything past the first 4 characters.
