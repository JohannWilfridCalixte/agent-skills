---
name: agentic-review-access-control
description: "Access-control review of a branch or diff: authn, authz, IDOR, tenant isolation, privilege escalation. Use to check who can read or change what in a change."
---

# Review Access Control

Can anyone read or change something they shouldn't? A dedicated zoom: be exhaustive, assume nothing is protected until you see the check. Report-only.

Scope: the diff and commit range from the caller; standalone → the current branch against the default branch.

## 1. Map

1. List every entry point the change adds or touches: HTTP routes, GraphQL resolvers and fields, RPC handlers, server actions, webhooks, queue consumers, scheduled jobs, CLI commands, file and export endpoints.
2. For each, trace from the entry to every data access and side effect, following helpers and middleware.
3. Fill a matrix: entry point | authn | authz | tenant scope | negative test.

Done when every entry point has a full matrix row.

## 2. Checks

Every check applied to every row:

- **Authentication**: required unless explicitly public, and the public intent is visible in code or spec.
- **Authorization**: enforced server-side at the resource level, deny by default; hidden UI or client checks don't count.
- **IDOR**: every identifier from input (path, query, body, headers, cookies) resolves through a query scoped to the caller. Check list, search, bulk, export, pagination, includes and nested expansions, not just single-resource routes.
- **Tenant isolation**: the tenant comes from the authenticated context, never from client input. Every data path is scoped: ORM and raw queries, caches and cache keys, search indexes, file storage paths, events, background jobs.
- **Privilege escalation**: mass assignment of role, owner or tenant fields; admin operations without role checks; users changing their own role or ownership.
- **Delegated actions**: jobs and webhooks acting for a user carry and check the original principal. Signed URLs and tokens are scoped and expire.
- **Tests**: negative cases exist (other user, other tenant, lower role → denied) on every protected entry point.

Severity per the report contract ([../agentic-review/references/report.md](../agentic-review/references/report.md)). Unauthenticated or unscoped access to non-public data, or an escalation path → blocker. Check present but bypassable or inconsistent → major. Missing negative test → major.

## Report

The matrix, then the report contract ([../agentic-review/references/report.md](../agentic-review/references/report.md)) with findings per [finding.md](../agentic-review/references/finding.md), written to the path the caller gives; standalone → in the reply.
