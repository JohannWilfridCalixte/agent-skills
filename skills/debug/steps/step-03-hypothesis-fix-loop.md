# Step 3: Hypothesis-Fix Loop

## Intent

Iteratively hypothesize root cause, implement fix, run regression test. Loop until the test passes or max iterations reached.

## Loop

```
max_iterations: 3
```

Each iteration:

1. **Hypothesize** — form ONE clear hypothesis: "The bug is caused by X because Y" (evidence from investigation)
2. **Fix** — implement ONE minimal change addressing the hypothesized root cause
3. **Test** — run the regression test from step 2
4. **Evaluate** — if test passes → done; if fails → refine hypothesis, next iteration

## Delegation

You **MUST** delegate each iteration to a subagent. You **MUST NOT** hypothesize or fix yourself.

Spawn a subagent per `agentic:skill:delegate-work`:

- **Persona**: `agentic:agent:software-engineer`
- **Skills**: `technical_skills_prompt`
- **Agent Type**: general purpose
- **Model**: `CODE_WRITING_MODEL`
- **Input**: `{output_path}/bug-report.md`, `{output_path}/investigation-report.md`, regression test path from state, and `{output_path}/hypothesis-log.md` (if exists from prior iteration)
- **Instructions**:
  1. Read all investigation evidence and prior hypotheses (if any)
  2. Form ONE hypothesis with evidence backing
  3. Implement ONE minimal fix — no bundled changes, no "while I'm here" improvements
  4. Run the regression test
  5. Run full test suite to check for regressions
  6. Report: hypothesis, fix description, test results, files changed

The subagent appends to `{output_path}/hypothesis-log.md` and writes `{output_path}/fix-log.md`.

## Rules

- **ONE variable at a time** — never change multiple things per iteration
- **Smallest possible change** — fix at source, not at symptom point
- **Revert on failure** — if hypothesis is wrong, revert changes before next iteration
- **Evidence-backed** — every hypothesis cites specific evidence from investigation

## Evaluate

After each iteration:

**If regression test PASSES and full suite green** → update state, proceed to step 4.

**If regression test FAILS and iterations < max** → log rejected hypothesis, increment iteration, re-delegate.

**If regression test FAILS and iterations >= max** → escalate.

## Escalation (3 Failed Iterations)

3 failed hypotheses = likely architectural problem, not a simple bug.

Create `{output_path}/escalation.md`:
- Hypotheses tested and rejected (with learnings)
- Pattern observed across failures
- Evidence references
- Recommendation for human review

Set workflow status to `escalated` and **HALT**.

## Update State

Per iteration:
```yaml
hypothesis_loop:
  iteration: {n}
  status: "in_progress" | "confirmed" | "escalated"
  hypotheses:
    - iteration: 1
      statement: "{hypothesis}"
      result: "CONFIRMED" | "REJECTED"
      learning: "{what this tells us}"
```

On success:
```yaml
artifacts:
  hypothesis_log: "{output_path}/hypothesis-log.md"
  fix_log: "{output_path}/fix-log.md"
```

## Next

Load `steps/step-04-verify.md`.
