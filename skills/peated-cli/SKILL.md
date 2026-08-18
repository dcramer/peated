---
name: peated-cli
description: Use the Peated repository CLI to authenticate, inspect or mutate API resources, query moderation queues, run classifier or maintenance commands, and diagnose CLI failures. Applies to `pnpm cli`, authenticated production API work, local `.env.local` workflows, and safe moderator operations.
---

# Peated CLI

Operate Peated through the repository entrypoint while keeping remote API calls,
local maintenance commands, credentials, and mutations at explicit boundaries.

## Choose the Execution Boundary

| Command surface                                              | Runtime                                         | Default effect                                           |
| ------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------- |
| `pnpm cli auth ...`                                          | OAuth against `api.peated.com` and `peated.com` | Manage a local seven-day credential                      |
| `pnpm cli api ...`                                           | Authenticated HTTP API; production by default   | Read or mutate the selected API deployment               |
| `pnpm cli classifier ...`                                    | Repository code loaded with `.env.local`        | Use configured DB, search, and model services            |
| Other domains such as `bottles`, `prices`, `users`, and `db` | Repository code loaded with `.env.local`        | May directly access the configured DB, queue, or storage |

Do not treat a domain command as a production API command merely because it is
under the same CLI. Inspect `.env.local`, command help, and the owning source
before running a non-`api` command with side effects.

## Discover Before Acting

1. Run commands from the repository root through `pnpm cli`; do not invoke the
   underlying `tsx` entrypoint directly.
2. Start with `pnpm cli --help` and `pnpm cli <domain> --help`.
3. Inspect the owning command under `apps/cli/src/commands/` when scope, dry-run
   behavior, or backing services are unclear.
4. For generic API work, inspect the current OpenAPI spec or owning route before
   constructing a mutation. Do not guess request fields.
5. Keep tokens, authorization headers, OAuth codes, private user data, and
   unrestricted provider payloads out of logs, attachments, and final reports.

Read [authenticated-api.md](references/authenticated-api.md) for OAuth, generic
API requests, server overrides, and mutation mechanics.

## Handle Mutations Deliberately

Treat every non-GET API request and every local command without an explicit
dry-run as potentially state-changing.

1. Resolve exact resource IDs and current state with read-only calls.
2. State the target, action, environment, and expected effect.
3. Obtain explicit user authorization unless the active request already gives
   a clear, bounded mutation scope.
4. Put the strict JSON body in a temporary file for `api post`, `put`, or
   `patch`; avoid shell interpolation of data.
5. Let the CLI prompt in an interactive terminal. Use `--yes` in a
   non-interactive agent session only after the mutation is authorized.
6. Re-read the resource or durable history after success and report the actual
   result. Stop on conflicts, stale state, or an identity that differs from the
   reviewed target.

Never turn permission to analyze, diagnose, or prepare a review into permission
to mutate production. Do not broaden a single-item or bounded-batch approval to
a bulk endpoint.

## Review Price-Match Proposals

Read [moderation.md](references/moderation.md) before reviewing or resolving the
price-match queue. Separate evidence gathering from execution:

1. Fetch an actionable page and then fetch each proposal's current details.
2. Compare the listing, extracted identity, candidate Bottles, and external
   evidence against Peated's complete-Bottle identity policy.
3. Record one proposed disposition: `match`, `create`, `repair`, `ignore`, or
   `needs_human`, with the decisive evidence and target ID where applicable.
4. Default to a read-only ledger for batch work. Execute only an explicitly
   authorized subset.
5. Re-fetch immediately before each mutation and verify immediately afterward.

Bias against false-positive matches and catalog mutations. Missing candidate
fields can be compatible with the same exact marketed Bottle; populated
identity conflicts are not. Do not borrow facts from sibling, batch, component,
or similarly named products.

## Run Local Maintenance Commands

Prefer commands with `--dry-run`, preview output, explicit IDs, and small
limits. If no dry-run exists, use local throwaway data or stop for approval
before touching a shared environment. Confirm the backing DB and worker before
commands that enqueue jobs or update rows.

For classifier smoke checks, use:

```bash
pnpm cli classifier run "Ardbeg Uigeadail"
pnpm cli classifier run --image /path/to/bottle.jpg
pnpm cli classifier run --input-file /tmp/classifier-input.json --initial-only
pnpm cli classifier rollout-report --days 30
```

Live classifier runs may incur model/search cost and use the configured local
database adapters. Use deterministic tests or stored eval fixtures when a live
call is unnecessary.

## Report the Result

Include the environment, command surface, resource IDs or bounded counts,
read/write status, verification performed, and any skipped or ambiguous items.
Do not reproduce credentials or dump unrelated API records.
