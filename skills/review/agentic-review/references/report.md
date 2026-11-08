# Report contract

Every reviewer returns the same report, written to `reviews/{n}-{reviewer}.md`:

1. First line `verdict: pass | changes-requested` and counts per severity.
2. The reviewer's own notes (matrix, what held), short.
3. `## Findings`, most severe first, each with `rule`, `location`, `severity`, `fix` (or `needs-user`), per [finding.md](finding.md). None → say so.

Severity is normative and never downgraded: a blocker is wrong behaviour, data loss, an exploitable vulnerability, missing authz, a leaked secret or a test that proves nothing; a major is a missing acceptance criterion or critical-path edge case, weak validation, a fragile test strategy or a consequential standard violation; blockers and majors block merge, minors (safe but suboptimal) and nits (cosmetic) do not.

Redact every secret value past its first 4 characters. Return only counts per severity and the file path.
