---
name: peated-cli
description: Operate the Peated repository CLI for OAuth, API reads and writes, moderation queues, classifier runs, maintenance commands, and CLI diagnosis. Use for `pnpm cli`, production API access, or `.env.local` command workflows.
---

# Peated CLI

Run from the repository root through `pnpm cli`.

## Select the Boundary

| Surface                                    | Target                                       |
| ------------------------------------------ | -------------------------------------------- |
| `auth`, `api`                              | OAuth-backed HTTP API; production by default |
| `classifier`                               | `.env.local` DB, search, and model services  |
| `bottles`, `prices`, `users`, `db`, others | `.env.local` DB, queue, or storage           |

For non-`api` commands, inspect `pnpm cli <domain> --help`, `.env.local`, and
`apps/cli/src/commands/<domain>.ts` before execution.

## Workflow

1. Discover commands with `pnpm cli --help` and subcommand help.
2. Resolve IDs and state read-only.
3. Check the current OpenAPI spec or owning route before building API writes.
4. Prefer dry-run, explicit IDs, and small limits.
5. Obtain authorization for the exact mutation scope.
6. Re-fetch after writes; stop on stale state, conflicts, or changed identity.

Never expose tokens, OAuth codes, authorization headers, or private user data.
Never infer write permission from a request to inspect, diagnose, or review.

Read only the relevant reference:

- OAuth or generic API: [authenticated-api.md](references/authenticated-api.md)
- Price-match review or resolution: [moderation.md](references/moderation.md)

For classifier commands, first inspect `pnpm cli classifier --help`. Live runs
may use paid model/search services; use stored tests or evals when sufficient.

Report target environment, read/write status, affected IDs or bounded counts,
verification, and skipped ambiguous items.
