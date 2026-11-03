# 0011 - Webapp runtime, storage and toolchain

**Status:** Accepted
**Date:** 2026-11-03

## Context

The webapp (ADR 0007) needs a runtime, a database and a monorepo toolchain. control-tower is the reference for package logic, but runs Node + tsx on Postgres.

## Decision

- Bun runs server and CLI. Storage is `bun:sqlite` through Kysely with a small Bun sqlite dialect (`kysely-bun-sqlite`, verified at implementation). Migrations use Kysely's Migrator with TS files; DB types are hand-written, no codegen, no dbmate.
- The sqlite file is `~/.agentic/agentic.db`, created on first run; the Migrator applies the schema at start.
- Default port 8787 (`--port` / `AGENTIC_PORT`). A busy port is a clear error: the CLI reads the port from `~/.agentic/serve.json`, so no auto-pick.
- v1 runs from a repo clone only (`bun install`, then a script for `agentic serve`). No npm publishing; revisit when a release pipeline is wanted.
- Monorepo root: private `package.json` with workspaces `applications/*` and `packages/*`, bun@1.4.2, turbo scripts (build, dev, test, typecheck, lint, verify); `turbo.json` mirrors control-tower (`transit` task, `development` export condition); tsconfig bases copied; root `tsconfig.json` so the `typescript` profile detects; root eslint config with `tooling-eslint-config` copied (scope renamed); one copied `scripts/check-workspace-manifests.ts`. No lefthook, commitlint or justfile in v1.
- TypeScript split copied from control-tower ADR 0002: TypeScript 7 per workspace for compile and typecheck, TypeScript 6.0.x for root and `tooling-eslint-config` (ESLint only), never converged; tsconfig options valid on both.

## Rationale

Fewest moving parts that fit one developer's machine; control-tower's lint and boundary tooling is reused rather than rebuilt.

## Consequences

Two TypeScript versions to maintain. Plugin files are untouched at root, but root `package.json`, `node_modules` and `tsconfig.json` now sit beside them; plugin install paths must be re-verified.

## History

| Date | Change |
|---|---|
| 2026-11-03 | Created |
