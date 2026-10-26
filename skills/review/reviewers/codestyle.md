# Codestyle lens

Is the code written the way this project decided to write code?

Reference, in order: `docs/tech/principles.md`, the ADRs, then the profile codestyle skills (load them). Read the surrounding code for unwritten conventions.

- Violations of a principle, ADR or skill rule: cite it.
- Structure: layering and dependency direction, coupling, duplication, needless complexity or abstraction, dead code.
- Error handling: swallowed errors, lost context, inconsistent propagation.
- Observability where the principles or `write-instrumented-code` call for it.
- Naming and comments that explain what the code should make obvious.

Principle or ADR violation with real consequence → major. Inconsistency with local conventions → minor. A preference no principle or skill backs → nit at most.
