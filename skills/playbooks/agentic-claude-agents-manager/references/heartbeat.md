# Heartbeat

The cron that catches units nothing else wakes the manager for: stalled turns, permission prompts, plan usage.

## Arm

Armed exactly while at least one unit is `running`; checked after every `manager status`. A unit `running` and no job → `CronCreate`, recurring, period = `heartbeat: <N>m` printed by `manager start`, on off-minutes (15 → `7,22,37,52 * * * *`), prompt `Heartbeat: run the agentic-claude-agents-manager beat`. No unit `running` → `CronDelete`. The job lives in this session only, fires only while the manager is idle, may run up to half a period late, expires after 7 days: re-arm then, and in every new manager session.

Done when a heartbeat job exists if and only if a unit is `running`.

## Beat

Per `running` unit, a progress **marker**: transcript message count (`list_events` header) `/` `lastActivityAt` (`get_session`) `/` branch head (`git log -1 --format=%h <branch>`). Usage = highest `percentUsed` of the `get_usage` plan windows; plan `not_applicable` or `unavailable` → omit `--usage` and tell the owner once. Run `manager beat --seen <id>=<marker>… --usage <pct>`, one `--seen` per running unit (an `<id> unseen` line names one left out: beat it too). Each unit's context % (`get_usage` with its session; unavailable → `-`) goes beside it in the status shown to the owner.

Done when every rung and `usage` line this `beat` printed is acted on.

## Rungs

Per unit, acted on from the `beat` output:

- `ok` → nothing.
- `nudge` → `SendMessage`: still running? End your turn with your status line.
- `stop-resume` → `stop_session`, then `SendMessage` a recap: task, last progress seen, next expected step.
- `ask` → owner, once per stall: keep waiting / restart / archive. Restart and archive only on the owner's explicit yes.

No progress and the last event a tool call awaiting approval → [relay.md](relay.md) Permission prompt.

## Usage

`usage <N>%` line (beat or status) → owner, once (SKILL.md step 4): continue / pause queue / downgrade models. Downgrade → `set_session_model` (applies from the unit's next turn) and `unit set --model`. Pause queue → skip `start` lines until the owner lifts it.

Done when the owner's choice is applied.
