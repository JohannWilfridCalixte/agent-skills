---
name: agentic:skill:ask-codebase
description: Use when the user asks a read-only question about codebase behavior, architecture, implementation rationale, dependencies, or existing project decisions
---

# Ask Codebase

Answer the question from inspected code and project knowledge. This is a read-only entry point: no source edits, documentation capture, workflow-state creation, or external posting is needed. An implementation or documentation request is a different authorized task.

1. Identify the question, repository, relevant revision, and affected components. Inspect available context before asking for facts the code can establish. If repository identity or a required source is unavailable, state that specific limit.
2. Use `agentic:skill:use-knowledge` retrieval. Read relevant root/section indexes, current accepted ADR/spec/product/glossary records, and linked successors. Preserve historical rationale without treating superseded decisions as current policy.
3. Trace the behavior in relevant code, tests, configuration, and callers. Read history or linked issue/PR evidence when the question asks why. Apply [exploration guidance](../delegate-work/references/exploration.md) and any relevant engineering skill references. A code pattern alone does not establish the original decision-maker's rationale.
4. For independent substantial questions, use native workers through `agentic:skill:delegate-work`, resolved `exploration` routing, and source/artifact write scopes both empty. Workers return answers/evidence in their response. Narrow questions can be investigated directly; neither route requires initializing a workflow. Keep independent work moving while workers investigate.
5. Synthesize a direct answer, inspected source citations with useful line anchors/revision, the distinction between observed behavior and documented rationale, and material unknowns/conflicts. Name the evidence that would resolve an unknown. If relevant docs conflict with code, show both; do not silently reconcile them by writing files.

## Answer contract

Lead with the answer. Support concrete claims near their citations. Include only the system context needed to explain it. Label inference explicitly. State what cannot be determined from available evidence; never fill missing rationale with plausible speculation. Mention obsolete decisions only when they explain the history or a conflict. A concise sourced answer is complete without a new plan, new ADR, or offer to edit documentation.

Use `agentic:skill:use-agentic` only when configuration, profile selection, or worker routing is needed. Honor already-established context and user read-only restrictions; initialization announcements create no approval gate.
