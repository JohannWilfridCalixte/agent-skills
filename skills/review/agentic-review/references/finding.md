# Finding contract

The report every reviewer returns is in [report.md](report.md) (file layout, verdict line, normative severity). This file holds the per-finding block, verdict rule, scale translation, needs-user and fix-list formats.

```markdown
### {reviewer}-{k}: {short title}

- **severity**: blocker | major | minor | nit
- **reviewer**: the reviewer skill name (`code-review`, `agentic-review-secrets`, …), or `ci` / `pr-comment` in an agentic-babysit-pr fix list
- **location**: `path:line` or `path:start-end` (`commit:<sha> path` for history)
- **rule**: what is violated: acceptance criterion, standard or ADR, skill rule, OWASP / CWE id
- **evidence**: the code or behaviour that shows it, quoted briefly
- **fix**: concrete code change
- **needs-user**: the human action, on a needs-user finding in place of `fix`
```

`k` numbers a reviewer's findings from 1; a carried finding keeps its id, a new one takes the next free `k`.

## Verdict

`changes-requested` when the file has at least one blocker, major or needs-user finding; else `pass`.

## Severity

Meanings and what blocks: [report.md](report.md).

Translate a reviewer's own scale into these four:

| Reviewer | Its scale → severity |
|---|---|
| `super-review` | Blocker → blocker · Should fix → major, except Over-engineering → minor · Deepening opportunity → minor · Nit → nit · Human gate → needs-user finding |
| `claude-security-review`, `pr-security-review` | HIGH → blocker · MEDIUM → major · LOW → minor |
| `code-review` | Spec: wrong behaviour → blocker, missing or partial requirement → major, scope creep → minor · Standards: hard violation → major, judgement-call smell → minor |
| any other | By report.md's meanings |

## Needs-user findings

A finding only a human can resolve (rotate a credential, rewrite history, design call) carries `needs-user` in place of `fix`. One needing both a code change and a human action is two findings: the code change with its `fix`, the human action with its `needs-user`. Needs-user findings never enter the fix list; agentic-review asks the user about them once the fix loop ends (its section 4).

## Rules

- One issue per finding. Point at the line, not the file.
- Stay on the change. Pre-existing issues only if the change makes them worse or they are security blockers; prefix the title with `pre-existing:`.
- Redact every secret value past its first 4 characters.

## Fix list

`reviews/{n}-fix.md` feeds `agentic-implement`: the blocker and major blocks with a `fix`, copied with their ids. agentic-babysit-pr writes the same format. `agentic-implement` adds one status line under each, exactly one of:

- `- **status**: fixed {sha}`
- `- **status**: disputed: {reason}`
- `- **status**: skipped`
