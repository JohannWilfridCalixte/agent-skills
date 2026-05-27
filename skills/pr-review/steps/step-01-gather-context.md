# Step 1: Gather Context

## Intent

Verify the PR exists, ask the developer for output preferences, then delegate codebase analysis to an architect subagent that produces `technical-context.md`.

## Verify PR

Use `gh pr view <ref> --json number,title,author,baseRefName,headRefName,headRefOid,body,labels,files` and `gh pr diff <ref>` to extract PR metadata and diff. For cross-repo PRs, add `--repo owner/repo`.

- Save metadata to `{output_path}/pr-metadata.md`
- Save diff to `{output_path}/pr-diff.patch`
- Store `head_commit_sha` from `headRefOid` in workflow state (needed for inline PR comments)
- If PR not found → **HALT** with error

## Output Preferences (Interactive)

You **MUST** use a question tool if available to ask the developer two questions:

**Output mode:**
- **Local** — markdown report + chat summary
- **PR comments** — review posted as GitHub PR inline comments

**Verbosity level:**
- **1 (Concise)** — severity + short description
- **2 (Detailed)** — severity + title + detailed description
- **3 (Comprehensive)** — severity + title + description + file:line + how to fix

In **batch mode**, the parent orchestrator passes these preferences — skip the interactive questions.

## Delegate Context Gathering

You **MUST** delegate this to a subagent. You **MUST NOT** analyze the diff yourself.

Spawn a subagent with:

- **Persona**: `agentic:agent:architect` — the subagent **MUST** read this file first
- **Skills**: pass `technical_skills_prompt` from workflow state (resolved language/framework skills)
- **Agent Type**: explorer / explore
- **Model**: automatic, defined by agent type otherwise default to fast model type haiku, composer or thinking intensity medium
- **Input**: `{output_path}/pr-diff.patch` + `{output_path}/pr-metadata.md`
- **Output**: `{output_path}/technical-context.md`

The architect analyzes the PR diff and surrounding codebase to produce technical context: affected modules, patterns, dependencies, test coverage. For cross-repo PRs where the codebase isn't locally available, the architect derives context from the diff and metadata only.

## Validate

After the subagent completes, verify `technical-context.md` exists and is non-empty.

## Update State

```yaml
head_commit_sha: "<from PR metadata>"
output_mode: "local | pr_comments"
verbosity: 1 | 2 | 3
artifacts:
  pr_metadata: "{output_path}/pr-metadata.md"
  pr_diff: "{output_path}/pr-diff.patch"
  technical_context: "{output_path}/technical-context.md"
```

## Next

Load `steps/step-02-review-loop.md`.
