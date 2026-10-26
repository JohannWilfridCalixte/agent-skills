# Tests lens

Would these tests catch a regression in the behaviour this change introduced, and survive a valid refactor?

Load `agentic-code-testing`; it is the reference. Run the changed tests once.

- Coverage: every changed behaviour and acceptance criterion has a test. Include a criterion → test matrix (covered, weak, missing). Bug fixes have a regression test.
- Tests verify behaviour through public interfaces, not implementation details.
- Isolation: order-independent, parallel-safe, no shared mutable state, no real clock or network unless intended.

| Anti-pattern | Severity |
|---|---|
| No meaningful assertion | blocker |
| Depends on execution order or shared state | blocker |
| Coupled to implementation details | major |
| Mocks internal collaborators | major |
| Sleeps or arbitrary delays | major |
| Critical path untested | major |
| Several behaviours in one test | minor |
| Happy path only on low-risk code | minor |
| Name doesn't state the expected behaviour | nit |
