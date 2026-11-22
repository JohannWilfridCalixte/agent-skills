# Sidequests

A unit hit a project-global problem outside its scope: SKILL.md step 4.

## Note

`sidequest` block: problem, where, whether it blocks, workaround. `manager unit set <raiser> --state waiting`, then ask the owner: address now?

## Yes

1. `manager unit add <sq id> --title … --kind sidequest --for <raiser> --input <problem + context>`.
2. Raising unit still live (not `done`, `merged` or `failed`) → `SendMessage` it: pause, end your turn with `Unit <id>: blocked` — paused for <sq id>. Then `manager unit set <raiser> --state paused --paused-by <sq id>`. Raiser already `paused` → no message, only `manager unit set <raiser> --paused-by <sq id>` (appends; it resumes once every sidequest pausing it merged).
3. List other live units likely affected (same files or area); ask the owner which also pause; same two moves for each (already `paused` → only the `--paused-by` append).
4. `manager status`: its `start <sq id>` line, first under the parallel cap → [launch.md](launch.md) Launch one unit.

Its PR merges ([merges.md](merges.md)) → `resume` lines bring the paused units back.

Done when the sidequest unit is `running` and every live unit the owner chose (raiser included) is `paused` by it.

## No

`manager backlog add --title … --from <unit> --context …`. Offer a tracker ticket: yes → create it in the project's tracker, `manager backlog set B<n> --ticket <url>`. `SendMessage` the unit: continue with its stated workaround.

Done when `B<n>` is open, the ticket answer is recorded and the unit is `running` with its continue message (SKILL.md Hand-off).

## Re-offer

`re-offer B<n>` line (a unit finished, or another unit raised it: `backlog set B<n> --from <unit>`) → ask the owner again. Started → `backlog set B<n> --state started` plus Yes above; dropped → `--state dropped`.

Done when the owner answered and `B<n>` carries the answer.

## Failed

`stuck <id>` line: a sidequest pausing the unit failed, nothing will resume it. Ask the owner per unit: resume with its workaround / keep paused (another sidequest: Yes above, `--paused-by` it) / fail the unit. Resume → `SendMessage` the unit: update, continue with its workaround, its held answers; `manager unit set <id> --state running` (leaving `paused` clears the list).

Done when the owner answered and the unit is `running`, still `paused` by a new sidequest, or `failed`.
