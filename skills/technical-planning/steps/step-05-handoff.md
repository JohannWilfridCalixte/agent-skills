# Step 5: Handoff

Revalidate the sealed accepted plan and its durable `acceptance.json` receipt with `validate-acceptance`. Ensure `{execution_context.spec_folder}/<spec-id>/` is the durable source of truth: PRD, plan, tickets, machine-readable plan, acceptance receipt and relevant decision provenance are not ignored and are included in the authorized delivery change set. Run logs may stay ignored. Do not commit merely to make a no-commit run appear durable: report local-uncommitted delivery accurately and provide the exact paths/change set for later persistence. Missing durable artifacts block handoff.

List absolute paths to the durable PRD/plan/tickets/plan.json/acceptance.json and transient input/context/decision evidence. Reconcile significant knowledge through `use-knowledge`, including accepted decisions and unresolved minor defaults; record no-change when appropriate.

## Optional issue publication

Prepare exact title/body for each ticket before offering publication. Reuse explicit authorization. Parent alone publishes, using explicit `--repo owner/repo` on every issue operation. Preserve dependency order and replace blocked-by references with confirmed issue numbers.

Use a stable marker in each body: `<!-- agentic-ticket:<spec-id>:<ticket-id> -->`, scoped by repository. Before create/retry, search and inspect issues in that repository for the exact marker, including closed issues. One match → reuse/update it for the accepted revision; zero → create; multiple → report ambiguous mapping and stop that item. Marker search must cover all pages; incomplete lookup is not proof of absence.

Persist per-ticket publication state under `prs.issue_publications[repo/spec-id/ticket-id]`: repository, ticket_id, spec_id, plan_revision, marker, status (`prepared | published | failed`), issue number/URL and last error. After a timeout or crash, reconcile server marker before retry. Save successful results individually; retry only unresolved items. Never publish duplicates because a prior state write was missed.

Resolve `execution_context.issue_close_policy` from configuration. `merge` uses closing references only in the eventual covered PR; `release` and `manual` use non-closing issue references. Release closure needs separately authorized verified release evidence; manual leaves it to the owner. Local integration, commit or PR creation does not itself close issues. A configured policy is already a recorded choice, not a reason to ask again.

## Complete

Provide a host-appropriate fresh-context handoff with a copyable invocation of `implement` on the absolute spec directory; legacy `/agentic:workflow:implement` is an adapter alias. A new chat/reset is optional, not a prerequisite hidden in `/clear`.

Mark planning completed only with validated accepted artifacts and reconciled knowledge. Authorized publication failures remain visible/pending (`blocked` while publication is required); skipped optional publication is a valid outcome. List local persistence/delivery status truthfully.
