# Agentic

Spec-driven development framework. Skills, agents, and workflows compose into development pipelines for LLM-powered editors (Claude Code, Cursor, Codex).

Ported from [@JohannWilfridCalixte/agentic](https://github.com/JohannWilfridCalixte/agentic). Transition in progress — see [Status](#status).

> **Use at your own risk.** Personal project exploring AI-driven development. No guarantees, no support, no liability assumed.

## Why Spec-Driven Development?

Traditional AI-assisted coding is unpredictable. Same prompt, different results. Same task, different approaches. Quality depends on the conversation, not the process.

Spec-driven development changes this:

- **Specs before code** — every implementation starts from a technical plan with resolved decisions, not a vague prompt
- **Structured workflows** — multi-step processes produce consistent outputs regardless of who runs them or when
- **Reviewable artifacts** — technical plans, investigation reports, review reports are durable documents, not chat ephemera
- **Separation of concerns** — the orchestrator plans, specialized agents execute, reviewers validate. No single agent does everything

The result: reproducible, auditable development pipelines where AI agents follow engineering discipline instead of improvising.

## Status

| Layer | Status | Notes |
|---|---|---|
| Agents / Personas | Stable | 4 agents: architect, software-engineer, security-engineer, qa |
| Skills / Rulesets | Stable | 6 engineering skills, 3 review skills |
| Workflow Prompts | Stable | 4 workflows + 1 sub-workflow |
| Tooling (CLI) | Alpha | Being tested, not published on npm yet |

### Ported Workflows

| Workflow | Status |
|---|---|
| `technical-planning` | Ported |
| `implement` | Ported |
| `debug` | Ported |
| `pr-review` | Ported |

### Not Yet Ported (from original implementation)

| Workflow | Description |
|---|---|
| `ask-codebase` | Question → code-informed answer |
| `product-spec` | Idea → PRD |
| `product-vision` | Idea → comprehensive vision document |
| `frontend-development` | Idea → design → frontend code |
| `auto-implement` | Idea → autonomous code (full pipeline) |
| `create-workflow` | Description → workflow files + templates |

## Install

### Via `agentic` CLI

Source: [@JohannWilfridCalixte/agentic-cli](https://github.com/JohannWilfridCalixte/agentic-cli) (not on npm yet — clone and build locally).

```bash
git clone https://github.com/JohannWilfridCalixte/agentic-cli.git
cd agentic-cli
bun install && bun run build

# Then in your project:
agentic init
agentic add <skill-or-agent>
agentic list
agentic update
agentic remove <skill-or-agent>
```

### Manual

```bash
git clone https://github.com/JohannWilfridCalixte/agentic-v2.git
cp -r agentic-v2/skills/ your-project/.agents/skills/
cp -r agentic-v2/agents/ your-project/.agents/agents/
```

### Compatibility with Vercel `skills` CLI

Skills (not agents/workflows) are compatible with [Vercel's `skills` CLI](https://github.com/vercel-labs/skills). Individual skills follow the same `SKILL.md` frontmatter convention:

```bash
npx skills add JohannWilfridCalixte/agent-skills --skill agentic:skill:typescript-engineer
npx skills add JohannWilfridCalixte/agent-skills --skill agentic:skill:clean-architecture
```

> Agents and workflows require the full `agentic` framework (use-agentic + use-workflow) and are not **fully** compatible with skill-only installs.

## Configuration

Create `.agentic.json` at your project root:

```json
{
  "namespace": "agentic",
  "selectedProfiles": ["typescript"],
  "profiles": [
    {
      "name": "typescript",
      "detect": ["tsconfig.json", "*.ts", "*.tsx"],
      "skills": ["agentic:skill:typescript-engineer"]
    }
  ],
  "ides": {
    "claude|codex|cursor": {
      "outputFolder": ".claude/_agentic_output",
      "highThinkingModelName": "opus",
      "codeWritingModelName": "sonnet",
      "qaModelName": "opus"
    }
  }
}
```

## Workflows

Workflows are multi-step orchestrated processes. Each workflow generates a run ID, creates an output directory, tracks state in `workflow-state.yaml`, and delegates technical work to subagents.

```
/agentic:workflow:technical-planning "Add user authentication with JWT"
/agentic:workflow:implement path/to/technical-plan.md
/agentic:workflow:debug "Login returns 401 for valid credentials"
/agentic:workflow:pr-review #42
```

### Technical Planning

Transforms specs, ideas, or issues into detailed technical plans.

| Step | What Happens |
|---|---|
| 1. Gather Context | Architect explores codebase → `technical-context.md` |
| 2. Grill | Question developer on every design decision until unambiguous |
| 3. Generate Plan | Produce implementable plan → `technical-plan.md` |
| 4. Handoff | Summarize artifacts, suggest implement workflow |

**Rules**: Always interactive. No plan generation while open questions remain. Codebase exploration delegated to architect subagent.

**Artifacts**: `input.md`, `technical-context.md`, `technical-decisions.md`, `technical-plan.md`

### Implement

Takes a technical plan and implements it — code, tests, review, optional PR.

| Step | What Happens |
|---|---|
| 1. Validate Plan | Confirm plan completeness, resolve skill profiles |
| 2. Implement | Software engineer subagent(s) code + test per plan |
| 3. Review Loop | review-code + review-tests + review-security (max 3 iterations) |
| 4. Finalize | Ask developer: create PR, commit only, or nothing |

**Rules**: Hard gate — won't start without valid technical plan. All code work delegated to subagents. Autonomous for steps 1-3, interactive for step 4.

**Artifacts**: `input-plan.md`, `implementation-log.md`

### Debug

Systematic debugging from bug report to verified fix.

| Step | What Happens |
|---|---|
| 1. Investigate | Gather evidence, trace failure → `investigation-report.md` |
| 2. Regression Test | Write FAILING test reproducing the bug |
| 3. Hypothesis-Fix Loop | Hypothesize → fix → test → loop (max 3 iterations) |
| 4. Verify | Review loop with review-code + review-tests |

**Rules**: Evidence before hypothesis. Regression test must exist and fail before any fix. One hypothesis at a time. Three failed iterations → escalate to human.

**Artifacts**: `bug-report.md`, `investigation-report.md`, `hypothesis-log.md`, `fix-log.md`

### PR Review

Reviews pull requests using parallel QA and security review agents.

| Step | What Happens |
|---|---|
| 1. Gather Context | Verify PR, extract diff/metadata, ask output mode |
| 2. Review Loop | review-code + review-tests + review-security (max 1 iteration) |
| 3. Report | Aggregate findings → local report or GitHub PR comments |

**Verdict logic**: Any blockers → `REQUEST_CHANGES`. No blockers + any majors → `COMMENT`. Clean → `APPROVE`.

**Artifacts**: `pr-metadata.md`, `pr-diff.patch`, `technical-context.md`, `review-report.md`

### Review Loop (Sub-Workflow)

Not invoked directly. Called by implement, debug, and pr-review.

Runs review skills in parallel → aggregates findings → fixes issues → re-reviews until clean or max iterations reached.

| Review Skill | Agent |
|---|---|
| review-code | qa |
| review-tests | qa |
| review-security | security-engineer |

## Agents

Four persona files defining role, decision heuristics, quality standards, and constraints.

| Agent | Role | Heuristics |
|---|---|---|
| **architect** | Codebase exploration, technical context, plans | Uncertain → fewer downstream consequences. Explore wide then narrow. |
| **software-engineer** | Clean, tested implementation | Simpler unless complexity justified. Instructions over conventions. |
| **security-engineer** | Vulnerability review, attacker mindset | Exploitability + impact. Missing auth → always blocker. |
| **qa** | Code + test review | Borderline severity → prefer lower. Pattern violation but works → minor. |

## Skills

### Engineering Skills (Rulesets)

| Skill | Purpose |
|---|---|
| `typescript-engineer` | TypeScript type safety, error handling, patterns |
| `python-engineer` | Python typing, error handling, 3.12+ patterns |
| `clean-architecture` | Ports & adapters, domain model, dependency rule |
| `code-testing` | Test philosophy, pyramid, anti-patterns, FIRST principles |
| `write-instrumented-code` | Logging, tracing, OpenTelemetry, JSON-only logs |
| `delegate-work` | Canonical pattern for dispatching subagents |

### Review Skills

| Skill | Checks | Output |
|---|---|---|
| `review-code` | Correctness, edge cases, patterns, maintainability | `review-code-{iteration}.md` |
| `review-tests` | Coverage, anti-patterns, isolation, naming | `review-tests-{iteration}.md` |
| `review-security` | Input validation, auth, injection, OWASP/CWE | `review-security-{iteration}.md` |

### Severity Scale

| Severity | Blocks Merge? | Meaning |
|---|---|---|
| Blocker | Yes | Incorrect behavior, exploitable vulnerability, data loss |
| Major | Yes | Missing edge case, coverage gap on critical path |
| Minor | No | Style inconsistency, defense-in-depth improvement |
| Nit | No | Cosmetic, naming preference |

## Architecture

```
agentic-v2/
├── agents/                  # 4 persona files
│   ├── architect.md
│   ├── software-engineer.md
│   ├── security-engineer.md
│   └── qa.md
└── skills/
    ├── use-agentic/         # Framework gateway (config, IDE detection, profiles)
    ├── use-workflow/         # Workflow engine (state, steps, artifacts)
    ├── technical-planning/   # Workflow: spec → plan
    ├── implement/            # Workflow: plan → code → review
    ├── debug/                # Workflow: bug → evidence → fix → verify
    ├── pr-review/            # Workflow: PR → parallel review → report
    ├── review-loop/          # Sub-workflow: parallel review + fix cycle
    ├── review-code/          # Review skill: implementation quality
    ├── review-tests/         # Review skill: test quality
    ├── review-security/      # Review skill: security vulnerabilities
    ├── typescript-engineer/  # Ruleset: TypeScript patterns
    ├── python-engineer/      # Ruleset: Python patterns
    ├── clean-architecture/   # Ruleset: ports & adapters
    ├── code-testing/         # Ruleset: testing philosophy
    ├── write-instrumented-code/  # Ruleset: observability
    └── delegate-work/        # Utility: subagent dispatch pattern
```

### Design Principles

- **Harness-agnostic** — natural language instructions, no tool-specific syntax. Works with any LLM editor.
- **Lost-in-middle mitigation** — workflow steps in separate files, loaded sequentially. No giant prompts.
- **Zero external dependencies** — fully self-contained skill library.
- **Orchestrator pattern** — the LLM orchestrates, subagents execute. Separation of planning and doing.

### Workflow Dependency Graph

```
technical-planning
    ↓ produces technical-plan.md
implement
    ├→ review-loop
    │   ├→ review-code (via qa)
    │   ├→ review-tests (via qa)
    │   └→ review-security (via security-engineer)
    └→ delegate-work

debug
    ├→ delegate-work
    └→ review-loop

pr-review
    ├→ delegate-work
    └→ review-loop

All workflows → use-workflow (state) → use-agentic (config)
```

### Skill File Structure

```
skills/{skill-name}/
├── SKILL.md              # Entry point (frontmatter + instructions + "load step 1")
├── steps/                # Workflows only — one file per phase
│   ├── step-01-*.md
│   └── step-02-*.md
├── references/           # Output templates
│   └── *.md
└── rules/                # Engineering skills only
    ├── _sections.md      # Category index with priorities
    ├── _template.md      # Rule format
    └── *.md              # Individual rules
```

### Naming Convention

| Prefix | Purpose | Example |
|---|---|---|
| `agentic:skill:X` | Reusable technique or ruleset | `agentic:skill:typescript-engineer` |
| `agentic:agent:X` | Persona with role + constraints | `agentic:agent:software-engineer` |
| `agentic:workflow:X` | Multi-step orchestrated process | `agentic:workflow:implement` |

## License

MIT

---

*Ported from [@JohannWilfridCalixte/agentic](https://github.com/JohannWilfridCalixte/agentic). For initial workflows and CLI documentation, see the original repo.*
