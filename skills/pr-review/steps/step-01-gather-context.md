# Step 1: Gather Context

## Identify and freeze each PR

Resolve full repository identity (including host when applicable) and PR number. Every GitHub operation uses that explicit repository; never reuse a bare number against the ambient checkout. Fetch metadata using `gh pr view <number> --repo <repo> --json number,title,author,baseRefName,baseRefOid,headRefName,headRefOid,body,labels,files` and fetch the diff with explicit `--repo`. Recheck metadata after extraction to ensure base/head did not move during capture; inconsistent metadata/diff must be refetched.

Assign literal scope ID `<host>/<owner>/<repo>#<number>@<base-sha>..<head-sha>`. Artifact path: `{output_path}/prs/{encodeURIComponent(full-repo-identity)}/{number}/{base-sha}..{head-sha}/`; keep immutable older snapshots separate. Save `pr-metadata.md`, `pr-diff.patch` and snapshot metadata/digest there. The parent records `prs[scope_id]` with repo, number, base_sha, head_sha, snapshot_path, snapshot_digest, diff_path, files, output_path, output_mode, verbosity and delivery state. The full scope is a literal JSON key, not a dotted path or abbreviated collection name.

Verify local context matches the recorded head/base. A wrong local checkout is not valid surrounding code: use a separate read-only snapshot/worktree at the required commit or fetch relevant files at that revision. Parent manages any Git mutations; never switch/reset the user's working branch. If code is unavailable, analyze immutable diff/metadata with explicit diff-only limitations. Missing material context makes coverage incomplete, never assumed clean.

## Preferences

Ask only unresolved choices, once for a batch:

- Output: local Markdown + chat, or authorized GitHub PR comments.
- Verbosity: 1 severity/short description; 2 severity/title/detail; 3 adds exact file/line and correction.

Use the available question mechanism within its limits, and retain existing explicit choices. A local-only request is already decisive and does not invite a posting permission question.

## Delegate context

Use `delegate-work` with exploration model role, selected per-repository skills, source-read-only/report-write capability, metadata/patch/aligned snapshot paths, relevant knowledge and [exploration guidance](../../delegate-work/references/exploration.md). The worker produces this scope's `technical-context.md`: affected modules, conventions, dependencies, coverage, downstream effects, cited revision and limitations.

Parent validates evidence/context alignment and resolves missing sections. It saves the per-scope result without concurrent child state writes. Missing PR or unavailable required access produces an explicit failed/blocked item; other independent PRs continue. Advance valid scopes to step 2.
