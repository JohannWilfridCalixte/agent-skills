# Step 2: Report-Only Review

Invoke `review-loop` for each frozen PR scope with:

| Field | Value |
|---|---|
| `mode` | `report` |
| `max_rounds` | `1` |
| `review_skills` | `review-code`, `review-tests`, `review-security` |
| `scope_id` | Exact repository/PR/head identity from step 1 |
| `target` | Explicit repo, base_sha, head_sha, immutable snapshot path/digest, saved PR diff and changed files |
| `write_scope` | Empty; reports are the only permitted writes |
| `inputs` | This PR's metadata, diff, context, selected skills, verbosity and relevant accepted spec paths |
| `output_path` | This PR's unique directory plus `reviews/` |

The target never falls back to an ambient working diff. All lenses receive the same immutable snapshot and the shared finding contract; code/tests/security execute independently up to capacity.

The loop returns `reported` after one pass with readiness `pass | changes_requested | incomplete`, deduplicated findings and coverage. Findings are reported, never fixed; remaining majors/blockers do not trigger a developer repair choice. Parent saves the returned result under `review_loops[scope_id]` and links it from `prs[scope_id]`; workers do not update shared state.

Missing material evidence/lens is an incomplete review, not approval. Retain successful independent batch reports even when another item is blocked. Load step 3 for each result with its limitations intact.
