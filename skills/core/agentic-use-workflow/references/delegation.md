# Delegation

## Subagent prompt

Names and paths only. Spawn it with a fresh context window (never a fork of the session); it loads skills and reads files itself, so nested references keep working and the prompt stays small.

```
Step: {step key}
Work item: {work-item path}
Workspace: {workspace.path}     # run every code read, write, check and commit here
Load skills: {model-invoked step skill}, {codestyle skills}     # names; absolute SKILL.md paths when the harness has no Skill tool
Skills: load each via the Skill tool. No Skill tool → open the SKILL.md path given and follow it;
        a skill you follow that says "call the Skill tool with X" → open ../X/SKILL.md next to it
        (else the installed X) and follow that.
Follow: {absolute SKILL.md path of a user-invoked skill}        # omit when none
Read: {input paths}
Write: {output path}            # omit for read-only steps
Goal: {one or two sentences of intent}
Agent: {agent label, e.g. impl-T2, review.ub-mode-1}
Progress: at each milestone, append one line to {work-item path}/events.jsonl with a single
          shell append (>>):                                                # omit for read-only steps
          {"ts":"<UTC now>","work":"{work}","run":"{run}","harness":"{harness}","workflow":"{workflow}","step":"{step key}",
           "task":"{task}","agent":"{agent}","type":"progress","summary":"<what just happened>","data":{}}
Return: short summary + output path (read-only: cited findings).
events.jsonl: append only; state.json belongs to the orchestrator.
```

Copy the `Skills:`, `Progress:` and `events.jsonl:` lines verbatim, placeholders filled (`run`, `harness` included): the subagent never loads agentic-use-workflow, so the brief is its only copy of these rules. Everything else goes in as a name or a path.

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
- Model: per-invocation `model` param (`opus`, `sonnet`, `haiku` or a full model id).
- Effort: per-invocation `effort` param, `low | medium | high | xhigh | max` depending on the model. Older versions: only the `effort` frontmatter of a subagent definition.
- `CLAUDE_CODE_EFFORT_LEVEL` overrides everything: if set, log it as the effort used.

### Codex

- Spawn: ask explicitly for a subagent per step and name its model and reasoning effort in the spawn request.
- Model / effort: explicit spawn values → `[agents]` defaults (`default_subagent_model`, `default_subagent_reasoning_effort`) → parent's. Effort is `model_reasoning_effort`: `low | medium | high | xhigh | max | ultra` depending on the model.
- Custom agents in `.codex/agents/*.toml` that set `model` / `model_reasoning_effort` win over spawn values: if one matches the step, its settings are what ran.
- Read-only steps: say so in the spawn request with the `explore` model, or use a custom agent with write tools disabled. A custom agent named `explorer` replaces the built-in one.

## Cross-harness

Step whose resolved `harness` ≠ own: run it as a non-interactive CLI of that harness instead of a subagent. Same brief, with absolute SKILL.md paths and the no-Skill-tool `Skills:` line, `harness` = target in `Progress:`. Log its `started` with `data.harness` = target.

1. Write the brief to a temp file. Launch in the background (harness background shell, else `&`), cwd = `workspace.path`, brief on stdin, stdout/stderr to a temp log. Parallel steps → one process each.
2. Wait for exit; no exit after `limits.crossHarness.timeout` minutes → kill it.
3. Its stdout (Codex: `-o` file) is the return. Writing step → check `Write:` exists and follows its contract.

Invocations (`{wi}` = work-item path, needed writable when outside `workspace.path`; `{gitdir}` = `git rev-parse --git-common-dir` in `workspace.path`, needed writable for commits when it is a worktree):

- **codex**: `codex exec -m {model} -c model_reasoning_effort="{effort}" -c approval_policy="never" -s workspace-write -c sandbox_workspace_write.network_access=true -C {workspace.path} --add-dir {wi} --add-dir {gitdir} -o {return file} - < {brief}`.
- **claude**: `claude -p --model {model} --effort {effort} --permission-mode acceptEdits --allowed-tools Bash --permission-prompts none --add-dir {wi} < {brief}`. `CLAUDE_CODE_EFFORT_LEVEL` in the env wins.
- **cursor**: `agent -p --force --model {model} --workspace {workspace.path} "$(cat {brief})"` (`cursor-agent` same). Effort: the model id variant that encodes it (`agent models`).

Auth check before launch: `codex login status`, `claude auth status`, `agent status`.

Failure (CLI not on `PATH`, not authenticated, non-zero exit, timeout, output missing or malformed): log `failed` for the attempt, `data: {reason}`; warn once; re-run the step as a native subagent, model / effort from Resolution levels 3-4 (built-in default, else harness default) on your own harness.

Native features change fast: prefer the harness's current docs over this file when they disagree.
