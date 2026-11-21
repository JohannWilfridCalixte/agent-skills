# Sidequests

A unit hit a project-global problem outside its scope: SKILL.md step 4.

## Note

`sidequest` block: problem, where, whether it blocks, workaround. `manager unit set <raiser> --state waiting`, then ask the owner: address now?

## Yes

1. `SendMessage` the raising unit to pause; `manager unit set <raiser> --state paused --paused-by <sq id>`.
2. List other live units likely affected (same files or area); ask the owner which also pause; same two moves for each.
3. `manager unit add <sq id> --title … --kind sidequest --for <raiser> --input <problem + context>` → [launch.md](launch.md) Launch one unit.

Its PR merges ([merges.md](merges.md)) → `resume` lines bring the paused units back.

Done when the sidequest unit is `running` and every unit the owner chose is `paused` by it.

## No

`manager backlog add --title … --from <unit> --context …`. Offer a tracker ticket: yes → create it in the project's tracker, `manager backlog set B<n> --ticket <url>`. `SendMessage` the unit: continue with its stated workaround.

Done when `B<n>` is open, the ticket answer is recorded and the unit is `running` with its continue message (SKILL.md Hand-off).

## Re-offer

`re-offer B<n>` line (a unit finished, or another unit raised it: `backlog set B<n> --from <unit>`) → ask the owner again. Started → `backlog set B<n> --state started` plus Yes above; dropped → `--state dropped`.

Done when the owner answered and `B<n>` carries the answer.
