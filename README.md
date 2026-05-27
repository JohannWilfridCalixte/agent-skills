# Agent Skills

AI-assisted development toolset. Skills, agents, and workflows compose into development pipelines that work across LLM-powered editors (Claude Code, Cursor, Codex).

## Quick Start

```bash
# Clone
git clone https://github.com/JohannWilfridCalixte/agent-skills.git

# Add to your project
cp -r agent-skills/skills/ your-project/.agents/skills/
cp -r agent-skills/agents/ your-project/.agents/agents/
```

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
    "claude": {
      "outputFolder": ".claude/_agentic_output",
      "highThinkingModelName": "opus",
      "codeWritingModelName": "sonnet",
      "qaModelName": "opus"
    }
  }
}
```

Then invoke any workflow:

```
/agentic:workflow:technical-planning "Add user authentication with JWT"
/agentic:workflow:implement path/to/technical-plan.md
/agentic:workflow:debug "Login returns 401 for valid credentials"
/agentic:workflow:pr-review #42
```

## Architecture

```
agent-skills/
├── agents/               # 4 persona files
│   ├── architect.md
│   ├── software-engineer.md
│   ├── security-engineer.md
│   └── qa.md
└── skills/
    ├── use-agentic/      # Framework gateway
    ├── use-workflow/      # Workflow engine
    ├── technical-planning/
    ├── implement/
    ├── debug/
    ├── pr-review/
    ├── review-loop/      # Sub-workflow
    ├── review-code/
    ├── review-tests/
    ├── review-security/
    ├── clean-architecture/
    ├── python-engineer/
    ├── typescript-engineer/
    ├── code-testing/
    └── write-instrumented-code/
```

### Naming Convention

| Prefix | Purpose | Example |
|---|---|---|
| `agentic:skill:X` | Reusable technique or ruleset | `agentic:skill:typescript-engineer` |
| `agentic:agent:X` | Persona with role + constraints | `agentic:agent:software-engineer` |
| `agentic:workflow:X` | Multi-step orchestrated process | `agentic:workflow:implement` |

### Design Principles

- **Harness-agnostic**: natural language instructions, no tool-specific syntax — works with any LLM editor
- **Lost-in-middle mitigation**: workflow steps in separate files, loaded sequentially
- **Zero external dependencies**: fully self-contained skill library

---

## Workflows

Workflows are multi-step orchestrated processes. Each workflow:

- Generates a run ID (`YYYYMMDD-HHMMSS-random4hex`)
- Creates an output directory at `{OUTPUT_FOLDER}/{workflow-name}/{run-id}/`
- Tracks state in `workflow-state.yaml` (decisions, steps, artifacts)
- Delegates technical work to subagents — the orchestrator never writes code

### Technical Planning

**Purpose**: Transform specs, ideas, or issues into detailed technical plans.

**Trigger**: Need a technical plan, architecture decisions before coding, open questions to resolve before implementation.

```
/agentic:workflow:technical-planning <spec.md | #issue | URL | inline description>
```

| Step | Intent |
|---|---|
| 1. Gather Context | Architect explores codebase → `technical-context.md` |
| 2. Grill | Question the developer on every design decision until unambiguous |
| 3. Generate Plan | Produce implementable plan → `technical-plan.md` |
| 4. Handoff | Summarize artifacts + suggest implement workflow |

**Key rules**:
- Always interactive — developer answers every structural question
- Gate rule — no plan generation while open questions remain
- Codebase exploration delegated to architect subagent

**Artifacts**: `input.md`, `technical-context.md`, `technical-decisions.md`, `technical-plan.md`

---

### Implement

**Purpose**: Take a technical plan and implement it — code, tests, review, optional PR.

**Trigger**: Have a technical plan ready to implement.

```
/agentic:workflow:implement <path/to/technical-plan.md | technical plan in context>
```

| Step | Intent |
|---|---|
| 1. Validate Plan | Confirm plan is complete, resolve skill profiles, analyze task dependencies |
| 2. Implement | Software engineer subagent(s) code + test per plan (parallelized when possible) |
| 3. Review Loop | `review-loop` with review-code + review-tests + review-security (max 3 iterations) |
| 4. Finalize | Ask developer: create PR, commit only, or nothing |

**Key rules**:
- Hard gate — will NOT start without a valid technical plan
- All code work delegated to subagents
- Autonomous for steps 1-3, interactive for step 4

**Artifacts**: `input-plan.md`, `implementation-log.md`

---

### Debug

**Purpose**: Systematic debugging from bug report to verified fix.

**Trigger**: Error logs, stack traces, failing tests, unexpected behavior, bug reports.

```
/agentic:workflow:debug <error.log | #issue | URL | error description>
```

| Step | Intent |
|---|---|
| 1. Investigate | Gather evidence, trace failure → `investigation-report.md` |
| 2. Regression Test | Write FAILING test reproducing the bug (red in TDD) |
| 3. Hypothesis-Fix Loop | Hypothesize root cause → fix → run test → loop until pass (max 3) |
| 4. Verify | Review loop with review-code + review-tests |

**Key rules**:
- Evidence before hypothesis — no guessing
- Regression test MUST exist and FAIL before any fix attempt
- One hypothesis at a time — never bundle multiple fix attempts
- Three failed iterations → escalate to human with evidence report

**Artifacts**: `bug-report.md`, `investigation-report.md`, `hypothesis-log.md`, `fix-log.md`

---

### PR Review

**Purpose**: Review pull requests using parallel QA and security review agents.

**Trigger**: PR number, URL, or batch of PRs to review.

```
/agentic:workflow:pr-review <PR ref> [<PR ref> ...]
```

| Step | Intent |
|---|---|
| 1. Gather Context | Verify PR, extract diff/metadata, ask output mode + verbosity |
| 2. Review Loop | `review-loop` with review-code + review-tests + review-security (max 1 iteration) |
| 3. Report | Aggregate findings → local report or GitHub PR comments |

**Output modes**: Local markdown report or inline GitHub PR comments (via `gh api`).

**Batch mode**: Multiple PR refs dispatched in parallel, results collected in summary table.

**Verdict logic**:
- Any blockers → `REQUEST_CHANGES`
- No blockers + any majors → `COMMENT`
- 0 blockers + 0 majors → `APPROVE`

**Artifacts**: `pr-metadata.md`, `pr-diff.patch`, `technical-context.md`, `review-report.md`

---

### Review Loop (Sub-Workflow)

Not invoked directly. Called by implement, debug, and pr-review.

Runs review skills in parallel → collects findings → fixes issues → re-reviews until clean or max iterations reached.

**Parameters** (set by calling workflow):

| Parameter | Type | Example |
|---|---|---|
| `max_iterations` | int | `3` |
| `review_skills` | list | `[review-code, review-tests, review-security]` |

**Persona mapping**:

| Review Skill | Persona |
|---|---|
| `review-code` | `agentic:agent:qa` |
| `review-tests` | `agentic:agent:qa` |
| `review-security` | `agentic:agent:security-engineer` |

**Loop behavior**:
1. Dispatch review subagents in parallel (one per skill)
2. Aggregate findings (blocker/major/minor/nit counts)
3. Exit if zero blockers + zero majors, or max iterations reached
4. Otherwise: group issues into independent fix sets → fix in parallel → re-review

---

## Agents

Four persona files define role, decision heuristics, quality standards, and constraints. Workflows spawn subagents with these personas.

### Architect

Meticulous technical thinker. Explores codebases, identifies constraints, produces technical context and plans.

**Heuristics**:
- Uncertain between options → favor fewer downstream consequences
- Exploring → cast wide first, then narrow
- Pattern exists → prefer consistency unless strong reason to diverge
- Estimating impact → think second-order: what breaks if this changes?

**Standards**: Exhaustive, evidence-based, edge-case aware, dependency-conscious.

### Software Engineer

Pragmatic implementer. Writes clean, tested code that solves the problem without over-engineering.

**Heuristics**:
- Choose approaches → favor simpler unless complexity justified
- Conventions vs instructions → instructions win
- Tests needed → prefer integration unless unit is clearly better
- Fix risks regression → flag before proceeding

**Standards**: Working first, readable, tested, minimal.

### Security Engineer

Security-focused reviewer with attacker mindset. Identifies vulnerabilities, data handling issues, auth/authz gaps.

**Heuristics**:
- Assessing severity → exploitability + impact together
- Missing input validation → user-facing = blocker, internal API = major
- Missing auth/authz → always blocker
- Questionable data handling → check if sensitive before flagging

**Standards**: Attack-surface aware, impact-focused, specific remediation, no false alarms.

### QA

Thorough code reviewer. Reviews implementation and tests for correctness, quality, and adherence to standards.

**Heuristics**:
- Borderline severity → prefer lower — avoid false urgency
- Pattern violation but code works → minor, not blocker
- Coverage gaps → assess risk (untested auth = major, untested log formatting = minor)
- Unsure about conventions → check existing code first

**Standards**: Evidence-based, actionable, proportional, complete.

---

## Review Skills

Atomic review units. Each skill reviews code from a specific angle and produces a structured report with severity-tagged findings.

### Review Code

Reviews implementation code (not tests) for correctness, quality, and maintainability.

**Checks**: Correctness, edge cases, pattern consistency, maintainability, error handling, observability/instrumentation.

**Output**: `review-code-{iteration}.md` with summary, issues by severity, and verdict.

### Review Tests

Reviews test quality, coverage, and anti-patterns.

**Checks**: Coverage vs plan/spec, behavior-based testing, isolation, naming.

**Anti-pattern detection**: The Liar, Shared State, Brittle Test, Over-Mocking, Flaky Test, Test-to-Code Coupling, Giant Test, Missing Edge Cases.

**Output**: `review-tests-{iteration}.md` with summary, coverage matrix, issues by severity, and verdict.

### Review Security

Reviews code for security vulnerabilities and compliance.

**Checks**: Input validation, API security, auth/authz, injection (SQL/XSS/SSRF/command/path traversal), data handling, configuration (hardcoded secrets, insecure defaults, cryptography), dependencies.

**Output**: `review-security-{iteration}.md` with OWASP categories, CWE IDs, issues by severity, and verdict.

### Severity Scale (All Review Skills)

| Severity | Blocks Merge? | Meaning |
|---|---|---|
| Blocker | Yes | Incorrect behavior, exploitable vulnerability, data loss risk |
| Major | Yes | Missing edge case, coverage gap on critical path, missing auth |
| Minor | No | Style inconsistency, defense-in-depth improvement |
| Nit | No | Cosmetic, naming preference |

---

## Engineering Skills

Reusable rulesets loadable by any agent during any workflow. Configured via profiles in `.agentic.json`.

### TypeScript Engineer

Rules for production-grade TypeScript. Covers type safety, error handling, code style, and patterns.

**Rule categories** (by priority):

| Priority | Category | Key Rules |
|---|---|---|
| CRITICAL | Core Principles | End-to-end type safety, narrow types, maximum inference |
| CRITICAL | Typing | `interface` for shapes, `readonly` everywhere, no `any`/`as`, zod schema inference |
| CRITICAL | Switch Exhaustiveness | `satisfies never` in default case for union/enum switches |
| HIGH | Error Handling | `Result<T, E>` in domain logic, no throwing |
| HIGH | Code Style | No abbreviations, guard clauses, max 3 levels nesting |
| MEDIUM | Imports | `import type` separated, grouped by origin |
| MEDIUM | Strategy Pattern | When same discriminator matched in 3+ locations |

### Python Engineer

Rules for production-grade Python (3.12+). Strict type checking with pyright/mypy.

**Rule categories** (by priority):

| Priority | Category | Key Rules |
|---|---|---|
| CRITICAL | Core Principles | End-to-end type safety, narrow types, maximum inference |
| CRITICAL | Types | `dataclass(frozen=True, slots=True)` for domain, Pydantic for external data, 3.12+ generics |
| CRITICAL | Match Exhaustiveness | `assert_never` in wildcard case for union/enum matches |
| HIGH | Error Handling | `Result` pattern (`Ok[T] / Err[E]`), no raising for expected failures |
| HIGH | Code Style | `snake_case`, guard clauses, max 3 levels nesting |
| MEDIUM | Imports | `TYPE_CHECKING` block, absolute imports only, grouped by origin |
| MEDIUM | Patterns | Strategy pattern, no mutable defaults, pattern matching over isinstance |

### Clean Architecture

Language-agnostic rules for backend code with business logic. Dependencies point inward — domain knows nothing about HTTP, databases, or frameworks.

**Rule categories** (by priority):

| Priority | Category | Key Rules |
|---|---|---|
| CRITICAL | Core Concepts | Layers (Domain → Application → Infrastructure → Presentation), dependency rule |
| CRITICAL | Ports and Adapters | Domain defines interfaces (ports), infrastructure implements (adapters) |
| CRITICAL | Domain Model | Entities with behavior (not anemic), value objects, domain services |
| HIGH | Use Cases | Thin orchestration — no business logic in application layer |
| HIGH | Dependency Injection | Composition root, constructor injection, interfaces over concrete types |
| MEDIUM | Testing Strategy | Domain = unit (pure), Application = unit (mock ports), Adapters = integration |
| MEDIUM | Common Mistakes | Premature abstraction, anemic domain, framework annotations in domain |

**When to use**: Default ON for any backend code with business logic (services, domain models, use cases, APIs with validation/calculations/state transitions). Skip for pure CRUD, scripts, prototypes, frontend-only.

### Code Testing

Philosophy and practical guidance for writing tests across all layers.

**Core insight**: "Write tests. Not too many. Mostly integration." — Guillermo Rauch

**Covers**:
- FIRST principles (Fast, Isolated, Repeatable, Self-validating, Timely)
- AAA structure (Arrange, Act, Assert)
- Testing pyramid vs testing trophy
- Test doubles taxonomy (dummy, fake, stub, spy, mock)
- Mocking rules (mock at boundaries, don't mock what you don't own)
- Anti-patterns (The Liar, Brittle Tests, Flaky Tests, Ice Cream Cone)
- DAMP over DRY (DRY for mechanics, DAMP for meaning)
- Coverage targets: 70-85% as sanity check, not strict gate

### Write Instrumented Code

Rules for adding logging, tracing, and instrumentation.

**Required fields** on every log/span: `service_name`, `service_revision`, `environment`.

**Rules**:
- JSON logs only — no `console.log`, no plain text, no multiline stack traces
- OpenTelemetry for tracing — instrument hot paths, critical logic, service boundaries
- `snake_case` attributes everywhere, same names in logs AND spans
- Multi-tenant apps: always include `tenant_id` (+ `company_id` if tenant = company)
- Forward correlation ID whenever possible
- Merge blocker: no plain logs or untagged spans

---

## Framework Internals

### Use Agentic

Gateway skill. Loaded before any other `agentic:*` resource. Handles:

- **Config lookup**: `.agentic.json` → `.agentic.config.json` → `.agentic/config.json` → `~/.agentic/config.json` → defaults
- **IDE detection**: Detects current editor (Claude Code, Cursor, Codex) and resolves IDE-specific settings
- **Profile resolution**: Matches `selectedProfiles` against `profiles`, collects skill lists → `technical_skills_prompt`
- **Constants**: `NAMESPACE`, `OUTPUT_FOLDER`, `HIGH_THINKING_MODEL`, `CODE_WRITING_MODEL`, `QA_MODEL`

### Use Workflow

Engine loaded by every workflow. Owns:

- **State tracking**: `workflow-state.yaml` with status, steps, decisions, artifacts, timing
- **Step sequencing**: Load steps one at a time (lost-in-middle mitigation), never skip ahead
- **Decision logging**: Every autonomous decision recorded with reason and context
- **Artifact management**: Prescribed outputs tracked by path
- **Communication mode**: Ultra-compressed output during workflow execution (abbreviations, arrows, sentence fragments) — reverts to standard English for security warnings, irreversible actions, code, docs, commits, PRs
- **Error recovery**: Failed step → log error, set status `failed`, present to user. Never silently continue.

### Workflow State Schema

```yaml
workflow: agentic:workflow:{workflow-name}
run_id: "{YYYYMMDD}-{HHMMSS}-{random4hex}"
topic: "{topic-slug}"
output_path: "{OUTPUT_FOLDER}/{workflow-name}/{run-id}"

started_at: "2026-05-27T10:00:00Z"
updated_at: "2026-05-27T10:15:00Z"
completed_at: null

technical_skills_prompt: |
  # Technical Skills
  Load: agentic:skill:typescript-engineer

status: "in_progress"  # pending | in_progress | completed | failed
current_step: 2

steps_completed:
  - step: 1
    name: "gather-context"
    completed_at: "2026-05-27T10:05:00Z"
  - step: 2
    name: "grill-requirements"
    completed_at: "2026-05-27T10:15:00Z"
    output: "{output_path}/technical-context.md"

decisions:
  - step: gather-context
    decision: "Focused on auth module"
    reason: "User spec mentions login flow"

artifacts:
  technical_context: "{output_path}/technical-context.md"
  technical_plan: null
```

---

## Configuration

### Config File

Place `.agentic.json` at your project root. Full schema:

```json
{
  "namespace": "agentic",
  "version": "0.2.0-beta.3",
  "workflows": ["technical-planning", "implement", "debug", "pr-review"],
  "profiles": [
    {
      "name": "typescript",
      "detect": ["tsconfig.json", "*.ts", "*.tsx"],
      "skills": ["agentic:skill:typescript-engineer"]
    },
    {
      "name": "python",
      "detect": ["pyproject.toml", "*.py"],
      "skills": ["agentic:skill:python-engineer"]
    }
  ],
  "selectedProfiles": ["typescript"],
  "ides": {
    "claude": {
      "outputFolder": ".claude/_agentic_output",
      "highThinkingModelName": "opus",
      "codeWritingModelName": "sonnet",
      "qaModelName": "opus"
    },
    "cursor": {
      "outputFolder": ".agents/cursor/_agentic_output",
      "highThinkingModelName": "claude-4.6-opus-high-thinking",
      "codeWritingModelName": "sonnet-4.6-opus-medium-thinking",
      "qaModelName": "claude-4.6-opus-high-thinking"
    },
    "codex": {
      "outputFolder": ".agents/codex/_agentic_output",
      "highThinkingModelName": "gpt-5.5",
      "codeWritingModelName": "gpt-5.3-codex",
      "qaModelName": "gpt-5.5"
    }
  }
}
```

### Config Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `namespace` | string | yes | `"agentic"` | Project namespace (`/^[a-z][a-z0-9-]{1,29}$/`) |
| `version` | string | no | — | Semver with optional prerelease |
| `workflows` | string[] | no | `[]` | Available workflow names |
| `profiles` | Profile[] | no | `[]` | Skill profiles (see below) |
| `selectedProfiles` | string[] | no | `[]` | Active profiles (must match `profiles[].name`) |
| `ides` | Record | no | `{}` | IDE-specific settings |

### Profile Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Unique profile identifier |
| `detect` | string[] | no | File globs for auto-detection |
| `skills` | string[] | yes | Fully qualified skill names (`agentic:skill:*`) |

### IDE Settings

| Field | Type | Default | Description |
|---|---|---|---|
| `outputFolder` | string | `"_agentic_output"` | Where workflow outputs go |
| `highThinkingModelName` | string | Best available | Model for planning, investigation, QA |
| `codeWritingModelName` | string | Best available | Model for implementation |
| `qaModelName` | string | Same as high thinking | Model for review subagents |

### Supported IDEs

| IDE | Key |
|---|---|
| Claude Code | `claude` |
| Cursor | `cursor` |
| Codex | `codex` |

---

## Skill File Structure

Every skill follows the same layout:

```
skills/{skill-name}/
├── SKILL.md              # Intent + setup + "load step 1"
├── steps/                # (workflows only)
│   ├── step-01-*.md      # Intent for phase + "load step N+1"
│   ├── step-02-*.md
│   └── ...
├── references/           # (optional) templates for output documents
│   └── *.md
└── rules/                # (engineering skills only)
    ├── _sections.md      # Category index with priorities
    ├── _template.md      # Standard rule format
    └── *.md              # Individual rule files
```

### Frontmatter

Every `SKILL.md` has YAML frontmatter:

```yaml
---
name: agentic:{type}:{name}       # Fully qualified name
description: When to use this      # Trigger conditions
argument-hint: "<usage pattern>"   # (optional) Expected arguments
---
```

---

## Adding New Skills

### Engineering Skill (Ruleset)

1. Create `skills/{name}/SKILL.md` with frontmatter, overview, when-to-use, rule categories table, quick reference (red flags), and how-to-use section
2. Create `skills/{name}/rules/_sections.md` listing categories by priority
3. Create `skills/{name}/rules/_template.md` with the standard rule format
4. Create one `skills/{name}/rules/{category}.md` per rule category
5. Add to a profile in `.agentic.json`

### Workflow

1. Create `skills/{name}/SKILL.md` with frontmatter, dependencies (use-agentic + use-workflow), input handling, steps table, key rules, artifacts, and "load step 1"
2. Create `skills/{name}/steps/step-{NN}-{name}.md` for each phase
3. Create `skills/{name}/references/{template}.md` for output templates
4. Add workflow name to `workflows` array in `.agentic.json`

---

## License

MIT
