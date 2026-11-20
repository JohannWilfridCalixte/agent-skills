# Delegation

## Spawn

1. Run `bun {agentic-use-workflow}/scripts/agentic.ts step <key> [--task t] [--unit id] [--agent label] [--skills a,b]`. It prints the model, effort and the filled brief ([brief-template.md](brief-template.md)) and logs `started` before any spawn.
2. Spawn a fresh-context subagent (never a fork), passing model and effort exactly as printed; the brief goes inline with its `Load skills:` line, replacing each `{{x}}`. A prompt pointing to a brief file is denied. It loads skills and reads files itself; the prompt carries names and paths.
3. Keep every line `hook spawn` checks, else the hook blocks the spawn: `Step:`, `Work item:` (existing, non-archived), `Load skills:`, `Skills:`, `Progress:` (or `read-only`), `Agent:` with its `started` event. Claude Code also compares the `Agent` or session tool's `model` (alias or full id, alias-normalised) and `effort` and the `Load skills:` set (order aside) with that `started` event; any difference is denied and the deny prints the expected values. No work item: `Work item: none`.

## Sessions

A session is a separate app session started with the harness's session tool (Claude desktop app: `mcp__ccd_session__start_session`). When that tool is offered, long steps run as sessions: `implement` units (fix lists included), `review.*`, `plan`, `write`, `tickets`. Quick read-only steps (`explore`, `context.*`, `chore`) run as subagents per Spawn.

1. Run `step <key>` as in Spawn. Printed model or effort above your own → subagent instead: a session runs at most at the orchestrator's model and effort.
2. Parallel unit: run the printed `git worktree add` first.
3. Start the session with:
   - `prompt`: the brief, per Spawn 2–3 (`hook spawn` checks it the same way), plus a last line `Report: full report on stdin to bun <helper> put <path>; final message = <path>, then ≤15 lines.` `<helper>` = the absolute `agentic.ts` path; `<path>` = `reviews/{n}-<reviewer>.md` for a reviewer, else `reports/{agent}.md`.
   - `context: "fresh"`, `initiation: "user_asked"` (the owner's standing choice), `wake_when_done: true`, a one-line `background` (≥80 characters).
   - `model`: the printed model as a full id (alias → its family's current id); `effort` as printed.
   - `use_worktree: false`; a parallel unit adds `cwd` = its worktree, so merge-back stays as for subagents.
4. Start every ready session, then end your turn: the app continues you as each one ends.
5. The app hands you only the report's first 400 characters, as a note: a pointer, not proof. Read the report file, then the unit's diff and commits; then log the `completed` or `failed` a subagent's return gets, same `agent` label (a reviewer's `put` already logged its `completed`).

Start refused or capped (a turn woken by another session's message is refused) → subagent per Spawn, same brief and `started` event.

Known limit: `hook subagent-stop` (skill-load check) covers subagents only; a session's skill loads go unchecked.

## Rules

- Reports: ≤15 lines + path to full output.
- Green gate: once per commit SHA.
- Parallel units: each gets its own worktree, cut from the work branch; `step --unit` prints the `git worktree add` command. Merge units back in task order before the gate. `resume` lists pending units.

## Harness mapping

Map the capability class to the closest model the harness offers. Set model and effort per spawn; a level the model doesn't support → nearest supported one. If the harness refuses or substitutes, run with what is available, warn once, log what actually ran.

Built-in explore agents often pick their own model or inherit the session's. Use one only if it runs the resolved `explore` model; otherwise spawn a general-purpose subagent with that model and a read-only brief, or a custom read-only agent pinned to it.

### Cursor

- Spawn: Task tool. Read-only steps: `explore` type when it accepts the `model` param, else a general-purpose subagent with a read-only brief (or a custom subagent with `readonly: true` and `model` set).
- Model: `model` param, a model id from the allowed list.
- Effort: bracket parameters on the model id, `claude-opus-5-5[effort=high]`. If the tool only accepts fixed slugs, pick the slug variant that encodes the effort (`…-high`).
- Fallbacks: team restrictions or plan limits can swap the model; the task card shows what ran.

### Claude Code

- Spawn: Agent tool. Read-only steps: built-in `Explore` with the `model` param when honored, else a general-purpose agent with a read-only brief, or a user agent named `Explore` (replaces the built-in) pinned to the model.
- Model: Agent takes `opus`, `sonnet`, `haiku`; the helper maps configured ids.
- Effort: per-invocation `effort` param, `low | medium | high | xhigh | max` depending on the model. Older versions: only the `effort` frontmatter of a subagent definition.
- `CLAUDE_CODE_EFFORT_LEVEL` overrides everything: if set, log it as the effort used.

### Codex

- Spawn: ask explicitly for a subagent per step and name its model and reasoning effort in the spawn request.
- Model / effort: explicit spawn values → `[agents]` defaults (`default_subagent_model`, `default_subagent_reasoning_effort`) → parent's. Effort is `model_reasoning_effort`: `low | medium | high | xhigh | max | ultra` depending on the model.
- Custom agents in `.codex/agents/*.toml` that set `model` / `model_reasoning_effort` win over spawn values: if one matches the step, its settings are what ran.
- Read-only steps: say so in the spawn request with the `explore` model, or use a custom agent with write tools disabled. A custom agent named `explorer` replaces the built-in one.

Native features change fast: prefer the harness's current docs over this file when they disagree.
