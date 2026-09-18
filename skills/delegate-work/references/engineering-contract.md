# Engineering task acceptance

Use for implementation, regression tests, and review/debug fixes. The assignment defines scope and acceptance; engineering skills supply language, architecture, testing, and observability rules.

## Work within accepted intent

- Solve the stated problem with the simplest justified design. Avoid speculative features, dependencies, and abstractions.
- Follow governing instructions and accepted decisions first; otherwise preserve existing codebase patterns. A convention alone does not create a new approval gate. Surface consequential instruction/architecture contradictions to the orchestrator with evidence and a concrete choice.
- Keep accepted architecture unchanged unless the orchestrator resolves the deviation within user-authorized scope. Return unresolved choices rather than guessing requirements. Record the justification for any new dependency.
- Fix root causes. In review repairs prioritize blockers before majors. Flag credible regressions outside the assigned scope before proceeding with a change that would cause them.

## Implementation and checks

Use self-explanatory names and comments for complex business logic where explanation is needed. Preserve full selected engineering policies, including TypeScript's entry point, rules, examples, and exceptions. Model choice does not relax these rules.

Every behavioral change has a meaningful corresponding test, written alongside the implementation. Use `agentic:skill:code-testing` for test design; prefer integration tests unless a unit test is the better boundary. Do not skip required tests to save time. Debug's failing-regression-before-fix gate and the caller's specific test order still apply.

Completion evidence shows that code compiles or the relevant type/build check passes, errors are handled according to the language/architecture policy, and required scoped tests pass. Report unavailable checks and failures exactly. The orchestrator's full-suite/integration gate remains separate; worker checks cannot replace it. Keep changes inside assigned files and return changed paths, commands, outputs, input/output revision, acceptance coverage, and unresolved risks.

## Escalation and ownership

When context cannot settle a structural choice, return the question, evidence, alternatives, and recommendation to the orchestrator; continue independent authorized work. Workers do not invent approvals, edit canonical run state, allocate ADR/RFC numbers, stage unrelated changes, or commit. Return proposed knowledge captures and the evidence needed for integration.
