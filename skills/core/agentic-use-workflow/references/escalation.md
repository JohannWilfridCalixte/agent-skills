# Escalation gate

Runs once the grills of a skill are done (`agentic-to-spec`, `agentic-to-plan`, a standalone grill when the user accepts). Events: [state.md](state.md#eventsjsonl).

1. **List** every `structural` decision in `decisions.md` with no `gate` event yet, with why each is flagged: reversibility cost, blast radius (data, public contract, security, cost), rejected alternatives.
2. **Decide**: per decision the user picks, logged as `gate` `{decision, outcome}`:
   - **confirm** → ADR `Accepted`.
   - **escalate** → ADR `Proposed`, optionally shared through available tools (chat, tracker). Log `escalation` `{id, status: "open", ref}`.
   - **revisit** → back to the grill on that decision; its new answer comes back to this step.

   Done when every listed decision is confirmed or escalated.
3. **Pass**: log `gate` `{passed: true, decisions: [ids]}`, `step: gate`; `decisions` = the ids listed in step 1, empty when none.
4. **Promote**: Call the Skill tool with "agentic-use-knowledge" (write mode), in `workspace.path`, with the confirmed and escalated decisions plus anything the calling skill adds (principles, terms). Commit there (`docs: …`). Done when committed, or nothing to promote.

Escalated decisions get settled at the next skill start: [state.md](state.md#resume) Resume step 0.
