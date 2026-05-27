---
name: agentic:skill:review-security
description: Use when reviewing code for security vulnerabilities, OWASP issues, auth/authz gaps, and data handling problems.
---

# Review Security

Review code for security vulnerabilities and compliance.

## Scope

**Security only.** Code quality is handled by `agentic:skill:review-code`.

## What to Review

- **Input validation** — user input reaching sensitive operations
- **API Security** — public or private api
- **Auth/Authz** — authentication checks, sessions management, authorization enforcement, privilege escalation
- **Injection** — SQL, XSS, SSRF, command injection, path traversal
- **Data handling** — sensitive data exposure, logging PII, insecure storage
- **Configuration** — hardcoded secrets, insecure defaults, missing security headers, cryptography
- **Dependencies** — known vulnerabilities in imported packages, supply chain attacks

## Severity Guide

| Severity | Meaning | Blocks? |
|----------|---------|---------|
| **Blocker** | Exploitable vulnerability, missing auth, data leak | Yes |
| **Major** | Missing input validation on user-facing endpoint, weak auth pattern | Yes |
| **Minor** | Defense-in-depth improvement, non-exploitable but suboptimal | No |
| **Nit** | Best practice suggestion, no real risk | No |

## Output

Write to `{output_path}/review-security-{iteration}.md`.

### Required Sections

1. **Summary** — severity counts + verdict
2. **Issues** — grouped by severity, each with:
   - OWASP category (if applicable)
   - Assign CWE IDs (if applicable)
   - Location (`file:line`)
   - Vulnerability description + impact
   - Remediation
3. **Verdict** — `PASS` | `CHANGES_REQUESTED`

## Inputs

Use when available:
- Code diff — actual changes
- Security requirements (if defined)
- Previous security reviews (for re-review iterations)
