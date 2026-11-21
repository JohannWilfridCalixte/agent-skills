# Resume

A new manager session over an existing ledger, or a hand-started session taken over: SKILL.md step 1.

## Resume

`manager start` printed the ledger's table. Per live unit: `get_session` (exists, `isRunning`, branch, model, effort) and `list_events` since its last known state; re-ask nothing already answered. Session gone → owner: relaunch from its brief / mark `failed`. A unit live → re-arm the heartbeat ([heartbeat.md](heartbeat.md) Arm). Then `manager status` → SKILL.md step 4.

Done when every live unit's session is checked and the heartbeat is armed if one is live.

## Adoption

The owner asks to take over a session started by hand. `list_sessions` to find it, `get_session` for path, branch, model, effort → `manager unit add <id> --kind adopted --title … --model … --effort …` → `manager unit set <id> --state running --session … --path … --branch …`. Not attended → `SendMessage` it the relay block of `manager brief <id>` (from `## Relay protocol` on): its questions now come through the manager. Heartbeat as usual.

Done when `manager status` shows it `running` and, not attended, it got the relay block.
