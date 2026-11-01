# Playbook

Start and autonomous tail shared by the build playbooks: `agentic-implement-feature`, `agentic-change-feature`, `agentic-debug`. `{workflow}` = the playbook's id: `implement-feature`, `change-feature`, `debug`.

## Start

Runs before the playbook's own start questions.

1. **Resume**: slug given → [state.md](state.md#resume) Resume: logged answers reused, done steps skipped. Open escalations → agentic-use-workflow [references/state.md](state.md#resume) Resume step 0.
2. **Log** workflow `started`: `workflow` = `{workflow}`, `step: null`.
3. **Steps**: from here, log each playbook step's `started` and `completed` (or `failed`) as it runs. `step` = `start`, a step the playbook names (`diagnose`), or the flow skill it runs: `to-spec`, `to-plan`, `to-tickets`, `implement`, `review`, `babysit-pr`. agentic-cleanup is no playbook step: it logs its own `cleanup` events.

Done when every open escalation is resolved or overridden and workflow `started` is logged; the user stopping at Resume step 0 ends the playbook instead.

## Autonomous tail

Runs once the playbook's last gate passed. Give the resume command once ([state.md](state.md#resume)), then ask the user nothing outside the interrupts below.

1. Call the Skill tool with "agentic-implement".
2. Call the Skill tool with "agentic-review". Its fix loop runs until no blocker or major remains.
3. Call the Skill tool with "agentic-babysit-pr", passing the playbook's merge-ready extras. It owns the merge-ready report, adds the extras, keeps watching, and returns once the PR is merged or closed. Merging is the user's call.
4. Merged → log workflow `completed` for `{workflow}`, then Call the Skill tool with "agentic-cleanup". It logs its own events and archives the work item; log nothing after it.

**Interrupts**, the only reasons to ask the user before the merge:

- a limit hit (`limits.review.iterations`, `limits.babysit.rounds`, `limits.implement.retries`: [config.md](config.md#limits)), asked by the flow skill that hit it;
- a design-level PR comment;
- a red tree that can't be fixed;
- a new escalation;
- the PR closed unmerged.

The answer continues the tail, or stops the run with the resume command. A new escalation always stops it (status `awaiting_decision`); resuming settles it at Resume step 0.

Done when workflow `completed` is logged and agentic-cleanup archived the work item, or an interrupt stopped the run and the resume command was given.
