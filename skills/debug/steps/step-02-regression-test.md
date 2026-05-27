# Step 2: Regression Test

## Intent

Write a FAILING test that reproduces the bug. This test captures the bugged behavior — it **MUST** fail before any fix. This is the "red" in TDD.

## Delegation

You **MUST** delegate this to a subagent. You **MUST NOT** write tests yourself.

Spawn a subagent per `agentic:skill:delegate-work`:

- **Persona**: `agentic:agent:software-engineer`
- **Skills**: `technical_skills_prompt`
- **Agent Type**: general purpose
- **Model**: `CODE_WRITING_MODEL`
- **Input**: `{output_path}/bug-report.md` + `{output_path}/investigation-report.md`
- **Instructions**:
  1. Read the investigation report to understand failure point and data flow
  2. Write a test that reproduces the exact bugged behavior
  3. Run the test — it **MUST FAIL** (proving it catches the bug)
  4. Capture the failure output
  5. Report: test file path, what it verifies, failure output

## Validate

After the subagent completes, verify:

- Test file exists
- Test was executed and **FAILED** (this is expected and correct)
- Failure output is captured

If the test passes, the test doesn't reproduce the bug — re-delegate with feedback.

## Update State

```yaml
regression_test_path: "{path to test file}"
regression_test_status: "failing"
artifacts:
  regression_test: "{path to test file}"
```

## Next

Load `steps/step-03-hypothesis-fix-loop.md`.
