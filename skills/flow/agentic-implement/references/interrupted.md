# Interrupted unit

A unit still `in_progress` at start (plan task, ticket or fix group) was cut off with its session. Its subagent = its latest `started` line: `run`, `agent`, and `data.files` = `{files}`. In `workspace.path`, check `git status -- {files}` and the commits citing the unit:

- **Committed, `{files}` clean** → run the green gate (SKILL.md step 4). Green → log what is missing (subagent `completed`, gate) and write its `implementation.md` entry. Red → step 4's retry.
- **Uncommitted edits in `{files}`** → show the user a diff summary of `{files}` and ask: **finish** (fresh subagent briefed with the unit and the partial diff, then step 4) or **set aside** (`git stash push -u -m "agentic {slug} {unit} interrupted" -- {files}`, then as nothing written). Keep the edits: never reset or delete them. Log the answer as a `choice` decision, key `interrupted.{run}.{unit}`.
- **Nothing written** → log `failed` with the subagent's `run`, `agent`, `task`, `step: implement`, `data: {reason: "interrupted, nothing written", interrupted: true}`: the unit is pending again.

Done when each interrupted unit is `done` or pending again.
