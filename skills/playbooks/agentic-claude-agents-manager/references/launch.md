# Launch

Adding units, the launch table and starting one unit: SKILL.md steps 2 and 3.

## Units

- **Id**: short kebab handle, `[a-z0-9-]` ≤ 24 chars, `none` reserved. It becomes the session `name` and `branch_name`.
- **Kind**: `playbook` (`--playbook <name>`, `--input` = its argument), `free` (`--input` = the task), `sidequest` ([sidequests.md](sidequests.md)), `adopted` ([resume.md](resume.md) Adoption).
- **Presets**, playbook units: each answer the owner already gave as `--preset k=v` (`mode`, `tickets`), plus `workspace=current`: the app already gives the unit its own worktree.
- **Attended**: the owner wants to talk in the unit itself → `unit set --attended true`: relay off, the manager only watches.
- **Model, effort**: `unit add` prints the config default (step keys `unit.<playbook>` → `unit`, `unit.sidequest`); `--model` / `--effort` override.

## Dependencies

B needs A's code → ask the owner, each time:

- `wait`: B starts now and holds implementation until A merges (its brief says so), then updates from the fresh default branch.
- `stacked`: B is cut from A's branch, so it starts once A runs with its branch recorded; its PR is retargeted after A merges.

Record `--deps <a> --dep-mode <answer>`.

## Launch table

Markdown table in chat: unit, kind/playbook, model, effort, deps. Then one AskUserQuestion: confirm / edit.

A unit starts at most at the manager's own model and effort (`get_session` `"self"`). Row above it → say so in the row and `unit set --model / --effort` to the manager's level. Raising later: `set_session_model` / `set_session_effort` (the owner approves in the app), then `unit set`.

## Launch one unit

Only on a `start <id>` attention line: it already applies the parallel cap and dependencies.

1. **Usage**: highest `percentUsed` of `get_usage` windows → `manager beat --usage <pct>` (usage only; its per-unit lines wait for the heartbeat). A `usage` line → [heartbeat.md](heartbeat.md) Usage first.
2. **Brief**: `manager brief <id>`. Line 1 = the `start_session` parameters; after `--- prompt ---`, the prompt.
3. **Start**: `mcp__ccd_session__start_session` with `initiation: "user_asked"`, `name` = id, `title` = unit title, `context: "fresh"`, `background` (≥ 80 chars: why this unit), `prompt` = the printed prompt verbatim, line 1's values as printed, `wake_when_done: true`.
4. **Record**: `get_session` on the returned `local_…` id → `manager unit set <id> --state running --session <local_…> --path <worktree path> --branch <branch>`. The app prefixes `branch_name` and adds a hex suffix: record the real branch.

Done when `manager status` shows the unit `running` with its branch.

## Launch refused

A turn that arrived over Remote Control, or was started by another session's message or a scheduled job, cannot call `start_session`. The unit stays `queued`; tell the owner in one line: send any message from the desktop app to launch it. Next owner turn → launch.

## Spawn denied

The spawn hook's reason names the fix (`manager brief <id>`, expected model and effort) → re-run `manager brief <id>` and pass its output unchanged. A session from this cwd that is no unit → prompt line `Manager unit: none`.
