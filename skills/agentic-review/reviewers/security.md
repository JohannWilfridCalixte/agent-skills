# Security lens

Can this change be abused? Review against the current OWASP Top 10, tagging findings with the OWASP category and CWE id.

Follow untrusted input (requests, headers, files, queue messages, third-party responses, env) from where it enters to where it is used. Access control and secrets have their own lenses: cover them only if they are not part of this run.

- **Injection**: SQL/NoSQL, OS command, template, LDAP, XPath, header, log injection. Queries parameterized, no string-built commands.
- **Output and browser**: XSS (unescaped output, raw HTML sinks), CSRF on state-changing routes, open redirects, missing security headers and cookie flags.
- **SSRF and files**: user-controlled URLs fetched server-side, path traversal, unrestricted uploads, unsafe archive extraction.
- **Deserialization and integrity**: untrusted deserialization, unsigned or unverified data, webhooks without signature checks.
- **Authentication**: credential handling, session lifetime and rotation, token validation (signature, expiry, audience), brute-force and enumeration protection, password reset flows.
- **Cryptography**: weak or homemade algorithms, static IVs or salts, non-cryptographic randomness for tokens, TLS verification disabled.
- **Data exposure**: sensitive data or PII in responses, logs, errors or analytics; over-fetching; stack traces to clients.
- **Misconfiguration**: insecure defaults, debug modes, permissive CORS, verbose errors, excessive privileges for services.
- **Supply chain**: new or bumped dependencies with known vulnerabilities, unpinned versions, unmaintained or typosquatted packages, install scripts.
- **Exceptional conditions**: failing open, unchecked errors on security paths, missing rate limits or resource bounds (DoS).
- **Insecure design**: business-logic abuse such as replay, race conditions on balances or quotas, skipped workflow steps.

Exploitable with realistic effort → blocker. Missing validation or a weak pattern on an exposed path → major. Defense in depth → minor. Best-practice suggestion with no real risk → nit.
