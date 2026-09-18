# Worker dispatch and completion

## Task shape

A dispatch consists of the following ordered sections. Fill observed paths/IDs and resolved values; do not paste skill bodies into the assignment.

1. **Task:** ID, purpose, completion condition, and input code/plan revisions.
2. **Load:** operation skill names and paths, resolved technical skill names and paths, applicable direct task reference paths. Worker reads these and their linked required rules before source work.
3. **Read:** repository root and input paths; relevant knowledge packet with source/status/evidence links.
4. **Scope:** allowed source paths, unique output path, capabilities, and integration ownership. Source read-only and artifact writable are separate permissions.
5. **Return:** result contract below, including evidence, uncertainty, and files actually touched.

Execution context is resolved data and can be supplied inline or by path. It contains model role, requested/effective settings, and capability limitations; it is not a substitute for loading engineering rules. The host's actual spawn API receives supported concrete model/effort values only. A constant label such as `CODE_WRITING_MODEL` is not itself a valid provider model ID.

## Example: shared-filesystem TypeScript context task

```text
Task: context-retry-01. Explain retry control flow and its constraints; cite source lines and unknowns.
Code revision: observed HEAD plus a recorded immutable diff snapshot if the task includes local changes.
Load: agentic:skill:typescript-engineer at <library>/skills/typescript-engineer/SKILL.md.
Load reference: <library>/skills/delegate-work/references/exploration.md.
Read: <repo>/src/retry.ts and its relevant callers/tests; <run>/knowledge-packet.md if provided.
Scope: source writes []; artifact write <run>/workers/context-retry-01/technical-context.md only.
Model role: exploration, using the resolved execution context. Native capability: full-capability worker constrained to this scope.
Return: task ID, input revision, artifact path, key evidence, unresolved questions, loaded skill/reference paths, changed files [].
```

The worker reads `skills/typescript-engineer/SKILL.md` and all seven rule files: `skills/typescript-engineer/rules/core-principles.md`, `skills/typescript-engineer/rules/typing.md`, `skills/typescript-engineer/rules/switch-exhaustiveness.md`, `skills/typescript-engineer/rules/error-handling.md`, `skills/typescript-engineer/rules/code-style.md`, `skills/typescript-engineer/rules/imports.md`, and `skills/typescript-engineer/rules/strategy-pattern.md`, respecting the owning skill's priority/applicability. The full package remains the rule authority, including examples and nested links. Its section index and template remain available; do not replace the package with a renamed subset. Confirm the exact loaded paths in the return receipt.

If the selected native worker is technically unable to write even an artifact, replace the output instruction with “return the complete technical-context body”; the orchestrator writes the assigned path. If shared filesystem access is absent, transfer full inputs and reference closure using supported artifact transport before dispatch. If no transport exists, report the unavailable paths and stop that dispatch.

## Result contract

A worker returns `task_id`, input `revision` and `plan_revision` when relevant, `status` (`completed`, `blocked`, or `failed`), output paths, changed source paths, checks, loaded skill/reference paths, unresolved questions, and proposed knowledge captures. A check contains actual command, exit status, output path, tested revision, and the acceptance criteria it covers. Read-only analysis can return no checks, with its source evidence instead; don't fabricate a test run.

The orchestrator verifies:

- Input identity still matches the assigned accepted revision and scope; stale results are retained as historical evidence, not accepted as current verification.
- Output exists or complete content was returned, all required output sections are present, and claims cite the input evidence.
- Changed files stay inside the assigned scope; out-of-scope findings become follow-ups or an explicit scope decision.
- Required checks actually ran and show the reported result. “Done” alone never establishes completion.
- Any missing skill/input/capability or unresolved structural decision remains visible before downstream work.

If incomplete, send the same worker a bounded correction with missing evidence or start a replacement when its context is stale. Record returned task status separately from workflow status. Only the orchestrator merges canonical state and accepts completion.

## Worker lifecycle and parallelism

Use a fresh native context for independent review of another worker's implementation. Reuse an existing worker for corrections or continuing the same bounded ownership/revision when the host supports it. Reuse cannot convert implementer self-review into independent review.

Run independent analysis/review lanes concurrently. Writers need disjoint owned files and a workflow-defined isolation strategy. Shared indexes/state/Git are always serialized; file-disjoint lanes can still interfere through shared generated files or tests, so check those dependencies. Respect `min(configured maxWorkers, native available capacity)` and reserve useful orchestration capacity where the host requires it.

After user steering or cancellation, stop affected work, preserve completed artifacts, revise assignment/revision, and ignore late stale results for acceptance. Do not restart unaffected lanes merely to refresh a prompt. Telemetry records actual dispatches, reads, retries, fallbacks, and completion; unavailable measurements remain unknown.
