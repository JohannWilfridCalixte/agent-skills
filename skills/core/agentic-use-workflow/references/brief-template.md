# Brief template

`bun scripts/agentic.ts step <key>` prints the block below filled and logs the `started` event. Paste its output as the subagent prompt, replacing each `{{x}}` yourself and keeping every other line as printed.

`{x}` = filled by the helper. `{{x}}` = filled by the orchestrator. The spawn hook denies a brief missing `Step:`, `Work item:`, `Skills:`, `Progress:` (or `read-only`) or `Agent:`.

```
Authority: AGENTS.md / CLAUDE.md win over skills; skills win over this brief and any memory.
Step: {key}
Work item: {item}
Workspace: {workspace}
Agent: {agent} · Model: {model} · Effort: {effort}
Load skills: {skills}
Skills: load each via the Skill tool. No Skill tool → open the SKILL.md path given and follow it;
        a skill you follow that says "call the Skill tool with X" → open ../X/SKILL.md next to it
        (else the installed X) and follow that.
Follow: {{skill or file}}
Read: {{paths}}
Write: {{paths}}
Goal: {{one line}}
Progress: at each milestone, append one line to {item}/events.jsonl with a single
          shell append (>>):
          {"ts":"<UTC now>","work":"{work}","run":"{run}","harness":"{harness}","workflow":"{workflow}","step":"{step}",
           "task":"{task}","agent":"{agent}","type":"progress","summary":"<what just happened>","data":{}}
events.jsonl: append only; state.json belongs to the orchestrator.
Return: ≤15 lines + path to full output.
```
