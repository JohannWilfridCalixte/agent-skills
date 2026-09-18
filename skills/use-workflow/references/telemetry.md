# Run telemetry

Measure actual work before tuning prompts or routing. The orchestrator appends records to `events.jsonl` in its run directory. Workers return events with their results so there is one file writer. Each event carries run/task identity, event type, time, and relevant model/config/revision context; source outputs remain the evidence.

Capture skill/reference reads, dispatch/completion, tool calls, required clarification pauses, check/review rounds, retries, fallbacks, and outcomes when the host exposes them. Record elapsed time and token counts only when measured; omit unavailable numeric measurements, never estimate them as fact. Keep request content, credentials, and unrelated personal data out of telemetry.

Each JSON line has nonempty `id`, `run_id`, `timestamp`, and `type` strings. Optional allowed fields are `schema_version`, `model`, `effort`, `duration_ms`, `value`, `task_id`, `input_tokens`, `output_tokens`, `cached_tokens`, `status`, `resource`, `revision`, and `configuration`. Measured durations/token counts are nonnegative finite numbers. Use `schema_version: 1` for new events. The pair `(run_id,id)` is stable: replaying the identical event is deduplicated; conflicting content under that pair is an error. Configuration contains routing/settings identifiers only, no prompts or sensitive payloads.

```json
{"schema_version":1,"id":"read-001","run_id":"20260911-120000-a1b2","timestamp":"2026-09-11T12:00:01Z","type":"skill_read","task_id":"context-01","resource":"skills/typescript-engineer/rules/typing.md","status":"completed","revision":"recorded-library-revision"}
```

Run `node <helper> telemetry <events.jsonl>` for a summary. Record the summary path in state `telemetry`; compare like-for-like task scope, fixture, model/effort, host overlay, and acceptance outcome. A shorter prompt or lower token count is not success if gates, tests, detected defects, or required engineering rules disappeared.

For prompt experiments retain no-guidance control, current-library, and changed-library results separately, with repeats and variation. Mark source walkthroughs and single application checks as such. Do not report benchmark reliability from an unmeasured example.
