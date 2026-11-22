# Launch

The launch table, adding units and starting one unit: SKILL.md steps 2 and 3.

## Units

- **Id**: short kebab handle, `[a-z0-9-]` ≤ 24 chars, `none` reserved. It becomes the session `name` and `branch_name`.
- **Kind**: `playbook` (`--playbook <name>`, `--input` = its argument), `free` (`--input` = the task), `sidequest` ([sidequests.md](sidequests.md)), `adopted` ([resume.md](resume.md) Adoption).
- **Presets**, playbook units: each answer the owner already gave as `--preset k=v` (`mode`, `tickets`), plus `workspace=current`: the app already gives the unit its own worktree.
- **Attended**: the owner wants to talk in the unit itself → `unit set --attended true`: relay off, the manager only watches.
- **Model, effort**: `unit add` resolves the config default (step keys `unit.<playbook>` → `unit`, `unit.sidequest`) unless the owner overrides: `--model` / `--effort`.

## Dependencies

B needs A's code → ask the owner, each time:

- `wait`: B starts now and holds implementation until A merges (its brief says so), then updates from the fresh default branch.
- `stacked`: B is cut from A's branch, so it starts once A runs with its branch recorded; its PR is retargeted after A merges.

Record `--deps <a> --dep-mode <answer>`.

## Launch table

`manager unit add <id> --title …` per unit, deps first (a dep must already exist). Then a markdown table in chat: id, title, kind/playbook, input, deps + mode, and the model and effort `unit add` printed.

**Cap**: a unit starts at most at the manager's own model and effort (`get_session` `"self"`). Printed above it → `unit set <id> --model / --effort` to the manager's level, and the row says so. Raising later: `set_session_model` / `set_session_effort` (the owner approves in the app), then `unit set`.

Then one AskUserQuestion: confirm / edit. Model, effort, attended → `unit set`. Any other edit, or a unit dropped → `unit set <id> --state failed --summary "replaced at launch"`; an edited unit is added again under a new id, and so is every dependent of a replaced unit, pointing at the new id (no dep for a dropped one). Each edit redraws the table.

Done when the owner confirmed the table and `manager status` lists every row with its values and every replaced unit `failed`.

## Launch one unit

Only on a `start <id>` attention line: it already applies the parallel cap and dependencies.

1. **Existing**: `list_sessions` with `linked: true` shows a session named `<id>` that no ledger unit records → ask the owner: record it as this unit (step 5 with it) / start a new one (step 2).
2. **Usage**: highest `percentUsed` of `get_usage` plan windows → `manager beat --usage <pct>` (usage only; its per-unit lines wait for the heartbeat; no `percentUsed` → skip). A `usage` line → [heartbeat.md](heartbeat.md) Usage first.
3. **Brief**: `manager brief <id>`. Line 1 = the `start_session` parameters; after `--- prompt ---`, the prompt.
4. **Start**: `mcp__ccd_session__start_session` with `initiation: "user_asked"`, `name` = id, `title` = unit title, `context: "fresh"`, `background` (≥ 80 chars: why this unit), `prompt` = the printed prompt verbatim, line 1's values as printed, `wake_when_done: true`.
5. **Record**: `get_session` on the `local_…` id → `manager unit set <id> --state running --session <local_…> --path <worktree path> --branch <branch>`. The app prefixes `branch_name` and adds a hex suffix: record the real branch.

Done when `manager status` shows the unit `running` with its branch.

## Launch refused

A turn that arrived over Remote Control, or was started by another session's message or a scheduled job, cannot call `start_session`. The unit stays `queued`; tell the owner once per queued unit: send any message from the desktop app to launch it. Its later `start` lines in such turns → skip. Next owner turn → launch.

Done when the owner has the line for every queued unit.

## Spawn denied

The spawn hook's reason names the fix (`manager brief <id>`, expected model and effort) → re-run `manager brief <id>` and pass its output unchanged. A session from this cwd that is no unit → prompt line `Manager unit: none`. Unit not `queued` (already started, or closed) → no second session: message the running session, or add a new unit.

Done when the relaunch passed the hook.
