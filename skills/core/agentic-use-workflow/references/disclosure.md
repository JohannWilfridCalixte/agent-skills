# Disclosure guard

Before posting unfixed vulnerabilities (agentic-security-audit's issues, tickets sliced from them) anywhere but local files:

- **GitHub**: the destination repo named explicitly (`owner/repo`), then `gh repo view <owner/repo> --json visibility`.
- **Jira, Linear, other**: ask the user whether the destination is visible only to the team.
- Public or unsure → warn that the posts disclose unfixed vulnerabilities and their exploit paths to everyone who can read the destination; recommend local or a private destination. Post only on the user's explicit confirm.

Log the outcome as a `choice` decision, key `disclosure.{destination}`, value `private` or `confirmed`. Done when the destination is private or confirmed; otherwise nothing is posted there.
