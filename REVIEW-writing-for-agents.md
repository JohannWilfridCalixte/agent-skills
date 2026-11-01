# Review: agentic skills vs writing-for-agents

2026-11-01. 4 Opus 5.5 high reviewers (core+codestyle, flow, review, playbooks). Vendored copies excluded. ~125 raw findings → deduped below. Paths relative to `skills/`.

## High (blockers: agent stalls or contradicts itself)

| # | Theme | Where | Fix |
|---|---|---|---|
| H1 | Escalations never resolvable: re-run offers only stop/override, nobody logs `resolved` → `awaiting_decision` forever | core/agentic-use-workflow state.md Resume; playbooks IF:20+53, CF:20+53, debug:18+39 | Resume step 0 "Open escalations": per escalation ask decided (update ADR/RFC via use-knowledge, log `resolved`) / override (log) / stop |
| H2 | `needs-user` findings unhandled ("escalate per use-workflow" doesn't resolve); secrets' needs-user drops a real secret from fix loop | review/agentic-review, finding.md, agentic-review-secrets | Define: needs-user = listed in report, not in fix list, blocks done until answered. Secrets: blocker fix=remove + `needs-user: rotate` |
| H3 | use-knowledge "write only gate-confirmed" vs to-spec writing spec content | core/agentic-use-knowledge:49 vs flow/agentic-to-spec:65 | Align: spec content written after spec gate counts as confirmed |
| H4 | grill-me "every caller gets a question" vs grill-tech "facts never a question" | flow/agentic-grill-me:34 vs grill-tech:15 | grill-me: "fact → look up (subagent); decision → ask" |
| H5 | implement "missing AC = plan defect: ask" fires on every fix-list unit → stalls review/babysit loops | flow/agentic-implement:42, :53 | Scope to plan tasks/tickets; fix unit AC = finding `rule`+`fix` |
| H6 | babysit "escalate" collides with workflow escalation → next implement round deadlocks | flow/agentic-babysit-pr:33,34,46 | "ask the user, log `choice` key `pr.{round}.{thread}`" |
| H7 | grill-me ordering: reads `../grill-me` before workflow load + Context → interview starts early; no-Skill-tool rule not loaded yet | flow/agentic-grill-me:9,13 | Workflow load first; grill-me hop moves into step 2 (or call `grilling` directly) |
| H8 | Standalone `agentic-grill-me tech` / no focus skips wrapper rules (ponytail, seams, GWT) | flow/agentic-grill-me:11,31 | Focus arg w/o wrapper → call `agentic-grill-{focus}`; no focus → run product, functional, tech |
| H9 | Cleanup logging contradiction: "log every step" vs "log `completed` before cleanup, nothing after" → cleanup events open new pass | playbooks IF:19/51, CF:19/51, debug:17/37 | Exempt cleanup from step logging; cleanup logs its own events |
| H10 | Playbook start/autonomous tail copied ×3, already drifted (override not logged) | playbooks IF, CF, debug | New `core/agentic-use-workflow/references/playbook.md` (Start + Autonomous tail); playbooks point to it |

## Medium

**Contradictions / unexecutable**
- `stop ponytail` said by agent to itself = no-op (grill-tech:25). Fix: "after agentic-grill-me returns, ponytail rules end; don't apply to gate, plan, implement, review".
- super-review.md: :5 skips integration but :13 uses Lifecycle step 7; truth-check below threshold → unfixable blocker; pasting conflicts with delegation.md:28; brief lacks reviewer list + PR info.
- agentic-review PR mode: ordering wrong, temp worktree vs workspace rule, posting skips disclosure guard for security blockers; verdict ambiguous; reviewers "model-invoked" vs config "any skill", no unavailable branch.
- pr-review picks report/post after pass; agentic-review asks before (pr-review:13).
- Merge-ready report placed in playbook never runs (control is in babysit) (IF:55, CF:55, debug:41) → move into babysit call args.
- to-plan "many thin tasks" vs light ≤5 cap (:51 vs :65,:73).
- to-tickets "may run as subagent" vs "non-interactive always subagent" (:44); disclosure guard after tracker choice (:42).
- cleanup "commits not on remote → ask" fires on every auto-deleted squash branch (:29); `started` logged after actions (:37).
- babysit: no `artifact` event → state.json `pr` stays null (:23,:39); "authority rules below" undefined (:13); Open section no action/Done (:20).
- agentic-code-testing contradicts itself on mocking; hard-coded in implement instead of profiles.
- agentic-configure loads whole runtime; "this repo skills/review" unexecutable; "write explicit values" freezes defaults.
- pr-security-review wrapper: `origin/<base>` doubling, git status; secrets scan flags gitignored `.env`.
- security-audit: `.gitignore` edit vs read-only (:29/:31) → use `.git/info/exclude`; obsolete rule misfires on scoped/quick passes (:76); dotted-key reuse vs Resume (:16 vs state.md:159).
- debug: diagnosing-bugs stop point unclear (:24) → Phases 1–4 + Phase 5 seam test + Phase 6 grep; harness files stall implement (:24–26) → move to `{work}/debug/`; no-seam branch unexecutable (:30).
- Gate-passed event shape missing (use-workflow).

**Single source of truth / drift**
- Key drift: `{iteration}` vs `{n}` (finding.md, implement:74, config); `interrupted.{run}.{unit}` vs `interrupted.{unit}` (implement:28 vs state.md:83); `tracker.run-{N}` holds `local` (security-audit) → `destination.run-{N}`.
- Lean rules restated in grill-me, product, functional, tech and ponytail; never-cut list has 3 names. Keep one block in grill-me pointing to ponytail's ladder; wrappers keep deltas only.
- use-workflow SKILL.md duplicates state/config/delegation ("subagents never touch state.json" ×4).
- Status-line format in finding.md and implement:74.
- claude-security-review description duplicates pr-security-review (reviewer suggests dropping pr-security-review from defaults).

**Progressive disclosure**
- to-plan light branch scattered (:13, :59–74) → `references/light.md` (Bug / Feature / Change).
- use-workflow: Escalation gate + Disclosure guard → references.
- implement interrupted-unit recovery → `references/interrupted.md`.
- security-audit publish/item format → `references/issues.md`.

**Design question (needs you)**
- change-feature ≈ 90% implement-feature; IF full mode doesn't pin branch, so to-spec may classify `change` anyway → IF description wrong. Reviewer: merge (IF classifies branch) or keep CF as thin alias.

## Low (batchable)

- Descriptions: trim mechanics/identity, one trigger per branch (grill-me, grill-*, cleanup ~70 words, babysit, implement, to-plan, IF, CF, use-workflow, use-knowledge, code-testing, agentic-review); drop no-op "or as an agentic-review reviewer".
- No-op lines: "it owns …" after every workflow load; "fresh context window" ×4; "Open escalations → stop" worded 3 ways; "Never merge" in desc+body.
- Cross-refs not landing: "agentic-use-workflow Resume" → `references/state.md#resume`; "Events" → "Events and state".
- Missing Done criteria: cleanup, playbook tails, security-audit :80–82, pr-review :12.
- Unpaired negation grill-functional:14; "ladder rung" undefined (grill-tech:16); "with its leading words" jargon (grill-me:11); "feature caller" coined (IF:40).
- to-spec: "Step 2" ambiguity (:53); Current-behaviour condition split from references/spec.md; `code/docs/runtime` vs `context.code`.
- to-tickets: "Needs plan.md" no action (:15); forward ref (:21).
- to-plan: per-task skills rule ×3; template comments restate rules; "or any playbook" overbroad.
- security-audit small gaps (run-* location, artifact names, field names `root_cause`/`remediation`, `current` stale on later passes).
- code-testing: TS-only examples, overlaps vendored tdd, GOOD-first ordering, beforeEach.
- Misc: `limits.x.y` notation vs flat dotted keys; `autopilot` unverified (babysit:13); `$agentic-configure` in Codex; model-id forms; no `agents/openai.yaml` on flow/core skills (Codex display name).

## Per-skill verdict

- **Pass / minor**: agentic-to-spec, agentic-pr-review, agentic-review-access-control, claude-security-review, playbook `agents/openai.yaml`.
- **Needs work**: everything else in core, flow, review, playbooks.
