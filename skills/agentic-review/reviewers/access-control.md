# Access-control lens

Can anyone read or change something they shouldn't? This is a dedicated zoom: be exhaustive, assume nothing is protected until you see the check.

## Method

1. List every entry point the change adds or touches: HTTP routes, GraphQL resolvers and fields, RPC handlers, server actions, webhooks, queue consumers, scheduled jobs, CLI commands, file and export endpoints.
2. For each, trace from the entry to every data access and side effect, following helpers and middleware.
3. Fill a matrix in the review file: entry point | authn | authz | tenant scope | negative test.

## Checks

- **Authentication**: required unless explicitly public, and the public intent is visible in code or spec.
- **Authorization**: enforced server-side at the resource level, deny by default; not only by hiding UI or relying on the client.
- **IDOR**: every identifier from input (path, query, body, headers, cookies) is resolved through a query scoped to the caller. Check list, search, bulk, export, pagination, includes and nested expansions, not just single-resource routes.
- **Tenant isolation**: the tenant comes from the authenticated context, never from client input. Every data path is scoped: ORM and raw queries, caches and cache keys, search indexes, file storage paths, events, background jobs.
- **Privilege escalation**: mass assignment of role, owner or tenant fields; admin operations without role checks; users changing their own role or ownership.
- **Delegated actions**: jobs and webhooks acting for a user carry and check the original principal. Signed URLs and tokens are scoped and expire.
- **Tests**: negative cases exist (other user, other tenant, lower role → denied). Missing on a protected entry point → major.

Unauthenticated or unscoped access to non-public data, or an escalation path → blocker. Check present but bypassable or inconsistent → major.
