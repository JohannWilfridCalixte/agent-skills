# Launch

The launch table, adding units and starting one unit: SKILL.md steps 2 and 3.

## Units

- **Id**: short kebab handle, `[a-z0-9-]` ≤ 24 chars, `none` reserved. It becomes the session `name` and `branch_name`.
- **Kind**: `playbook` (`--playbook <name>`, `--input` = its argument), `free` (`--input` = the task), `sidequest` ([sidequests.md](sidequests.md)), `adopted` ([resume.md](resume.md) Adoption).
- **Presets**, playbook units: each answer the owner already gave as `--preset k=v` (`mode`, `tickets`), plus `workspace=current`: the app already gives the unit its own worktree.
- **Attended**: the owner wants to talk in the unit itself → `unit set --attended true`: relay off, the manager only watches.
- **Model, effort**: config default (step keys `unit.<playbook>` → `unit`, `unit.sidequest`) unless the owner overrides: `--model` / `--effort`.

## Dependencies

B needs A's code → ask the owner, each time:

- `wait`: B starts now and holds implementation until A merges (its brief says so), then updates from the fresh default branch.
- `stacked`: B is cut from A's branch, so it starts once A runs with its branch recorded; its PR is retargeted after A merges.

Record `--deps <a> --dep-mode <answer>`.

## Launch table

Before any `unit add`: markdown table in chat: id, title, kind/playbook, input, deps + mode, model, effort. Then one AskUserQuestion: confirm / edit; an edit redraws the table.

A unit starts at most at the manager's own model and effort (`get_session` `"self"`). Row above it → say so in the row and pass the manager's level as `--model` / `--effort`. Raising later: `set_session_model` / `set_session_effort` (the owner approves in the app), then `unit set`.

Confirmed → `manager unit add <id> --title …` per row with its values, then one chat line per unit with the model/effort `unit add` printed. Later edits: model, effort, attended → `unit set`. Any other edit, or a unit dropped → `unit set <id> --state failed --summary "dropped at launch"`; an edited unit is added again under a new id.

Done when `manager status` lists every confirmed row with its values.

## Launch one unit

Only on a `start <id>` attention line: it already applies the parallel cap and dependencies.

1. **Existing**: `list_sessions` with `linked: true` shows a session named `<id>` → step 5 with it.
2. **Usage**: highest `percentUsed` of `get_usage` plan windows → `manager beat --usage <pct>` (usage only; its per-unit lines wait for the heartbeat; no `percentUsed` → skip). A `usage` line → [heartbeat.md](heartbeat.md) Usage first.
3. **Brief**: `manager brief <id>`. Line 1 = the `start_session` parameters; after `--- prompt ---`, the prompt.
4. **Start**: `mcp__ccd_session__start_session` with `initiation: "user_asked"`, `name` = id, `title` = unit title, `context: "fresh"`, `background` (≥ 80 chars: why this unit), `prompt` = the printed prompt verbatim, line 1's values as printed, `wake_when_done: true`.
5. **Record**: `get_session` on the `local_…` id → `manager unit set <id> --state running --session <local_…> --path <worktree path> --branch <branch>`. The app prefixes `branch_name` and adds a hex suffix: record the real branch.

Done when `manager status` shows the unit `running` with its branch.

## Launch refused

A turn that arrived over Remote Control, or was started by another session's message or a scheduled job, cannot call `start_session`. The unit stays `queued`; tell the owner once per queued unit: send any message from the desktop app to launch it. Next owner turn → launch.

## Spawn denied

The spawn hook's reason names the fix (`manager brief <id>`, expected model and effort) → re-run `manager brief <id>` and pass its output unchanged. A session from this cwd that is no unit → prompt line `Manager unit: none`.
