---
name: peated-cli
description: Use Peated's authenticated API client for OAuth-backed production API reads and writes through `pnpm cli auth` and `pnpm cli api`. Direct database-backed CLI command groups are legacy and unsupported for operations.
---

# Peated API Client

Run the authenticated client from the repository root.

## Supported Boundary

| Surface         | Target                                       |
| --------------- | -------------------------------------------- |
| `pnpm cli auth` | OAuth credentials                            |
| `pnpm cli api`  | OAuth-backed HTTP API; production by default |

Do not add, recommend, or use direct database-backed command groups for
operations. Those commands are legacy. If an operation is not available over
HTTP, add a permission-checked API route and call it through `pnpm cli api`.

## Workflow

1. Resolve IDs and state through read-only API requests.
2. Check the current OpenAPI spec or owning route before building API writes.
3. Prefer preview routes, explicit IDs, and small limits.
4. Obtain authorization for the exact mutation scope.
5. Re-fetch after writes; stop on stale state, conflicts, or changed identity.

Never expose tokens, OAuth codes, authorization headers, or private user data.
Never infer write permission from a request to inspect, diagnose, or review.

Read only the relevant reference:

- OAuth or generic API: [authenticated-api.md](references/authenticated-api.md)
- Price-match review or resolution: [moderation.md](references/moderation.md)

Report target environment, read/write status, affected IDs or bounded counts,
verification, and skipped ambiguous items.
