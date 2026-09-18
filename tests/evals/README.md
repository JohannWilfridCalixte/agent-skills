# Evaluate behavior and efficiency

These fixtures support the requested writing-skills method: observe failures, change the smallest owning contract, replay the case, and inspect new failure modes. Deterministic contract tests and source walkthroughs complement this campaign; they do not replace model application tests.

## Conditions and isolation

Run the same fixture and tool capabilities in three conditions: no library, original library at `a15b9b6b0e5e024588669d0cd8ba27944ad989c7`, and this migrated library. Pin the actual model and effort separately for Astra and Fable. Record the complete system/developer/host overlay. A normal Codex conversation has built-in engineering guidance, so a no-library sample here is not an instruction-free control.

Use a fresh context for every repetition; do not reuse a reviewer/implementer task that saw the rubric or a previous result. Shuffle condition order. Keep rubrics outside worker-visible input. At least five samples per variant are required for wording microtests; broader task completion and reliability require a larger workload.

```sh
node skills/use-workflow/scripts/evaluate.mjs prepare . tests/evals/cases.json /tmp/agentic-eval-migrated migrated-library 5
node skills/use-workflow/scripts/evaluate.mjs prepare . tests/evals/cases.json /tmp/agentic-eval-control no-library 5
```

For original-library samples, pass a separate read-only checkout of the pinned original revision. The preparation tool copies complete skill/reference packages into each sample; it never changes or checks out your working repository. Feed each `prompt.txt` to a fresh native worker. Model invocation remains host-owned: no API keys, paid model calls or third-party uploads are hidden in this helper.

Use application cases for references and techniques; use combined time/scope/sunk-cost pressure for gates and workflow discipline. An evaluator reads the actual transcript and produced artifacts against each case's `criteria`. Exact keyword matches alone cannot establish behavior.

## Record one result per sample

```json
{"sample_id":"pr-report-1","case_id":"pr-report","condition":"migrated-library","model":"actual-host-model-id","effort":"high","host_overlay":"pinned-overlay-sha256","transcript":"results/pr-report-1.md","reviewer":"human-or-independent-evaluator","pass":true,"failed_criteria":[],"elapsed_ms":null,"input_tokens":null,"output_tokens":null,"tool_calls":null,"clarifications":null}
```

Only write `pass:true` after adjudication. Use null for unavailable measurements. Do not fill in expected timings, invent tool usage, or report configured models as executed models. Store actual failed rationalizations verbatim in the transcript, then link a correction and rerun. The source baseline and per-skill author checks from this migration are recorded as such, not as these independent repeated experiments.

```sh
node skills/use-workflow/scripts/evaluate.mjs summarize results.jsonl
```

Predeclare acceptable tolerances for end-to-end task quality and efficiency. Compare acceptance criteria completed, defects caught, false positives, unauthorized changes, lost decisions, resumed-work correctness, skill reads, tool calls, clarification pauses, retries, tokens and time. Keep required gates, independent reviews and TypeScript policy invariant. Investigate any quality regression before celebrating a shorter prompt.

## Additional end-to-end fixtures

Before adopting routing changes, run a real one-ticket feature, an expand–contract migration with concurrent lanes, a seeded bug with an incorrect initial regression test, a cross-repository PR batch with a changing head, and a fresh-checkout plan handoff. Give the harness isolated fixture repositories and controlled publication mocks. Never use production issues, messages, secrets or customer data as a convenient test fixture.
