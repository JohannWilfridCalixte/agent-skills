# Spec lens

Does the change do what was asked, correctly, completely, and nothing more?

Reference: acceptance criteria in `spec.md` and `plan.md`. Without a work item, use the PR description, linked tickets and commit messages, and say which you used.

- Map every acceptance criterion to the code and test that satisfy it: met, partial or missing. Put this matrix in the review file.
- Behaviour that contradicts the spec, or is simply wrong: edge cases, empty and boundary inputs, error paths, concurrency.
- Deviations logged in `implementation.md` that change a contract the spec defined.
- Scope creep: changes no task asked for.

Missing criterion or wrong behaviour → major; blocker if it breaks a public contract or loses data. Unrequested change → minor unless it carries risk.
