# Authenticated Peated API

Use this reference for `pnpm cli auth` and `pnpm cli api`.

## Authenticate

Check the existing credential first:

```bash
pnpm cli auth status
```

If login is required in an agent session, start one login listener and keep it
alive:

```bash
pnpm cli auth login --no-open
```

Give the printed authorization URL to the user, wait for them to approve it,
then resume the same process. Do not start a second listener while the first is
waiting. The CLI stores the bearer credential under
`$XDG_CONFIG_HOME/peated/credentials.json`, falling back to
`~/.config/peated/credentials.json`, and never prints the token.

The default servers are:

- API: `https://api.peated.com`
- Web authorization: `https://peated.com`

For another deployment, pass `--api-server` and `--web-server` to `auth login`.
Only HTTPS and loopback HTTP origins are accepted. Confirm the target
environment before authenticating or mutating.

## Read API Resources

Pass an API path without `/v1`; the client adds that prefix. The path must begin
with one slash. Quote paths containing query parameters so the shell does not
interpret `&`.

```bash
pnpm cli api get /bottles/123
pnpm cli api get '/prices/match-queue?kind=create_new&limit=25&cursor=1'
```

Successful responses are JSON. Authentication and moderator/admin permissions
remain enforced by the API. Use `https://api.peated.com/spec.json` or the route
under `apps/server/src/orpc/routes/` as the current contract.

## Send Mutations

Write the exact JSON body to a temporary file, then select the HTTP method:

```bash
pnpm cli api post /some/resource --input /tmp/peated-request.json
pnpm cli api put /some/resource --input /tmp/peated-request.json
pnpm cli api patch /some/resource --input /tmp/peated-request.json
pnpm cli api delete /some/resource
```

The CLI prompts before non-GET requests in an interactive terminal. A
non-interactive session refuses the request unless `--yes` is supplied. Treat
`--yes` as an approval bypass: use it only after the user has authorized the
exact target and effect.

Before sending:

- Re-fetch the target and verify its ID, status, and ownership.
- Validate the body against the current route schema.
- Avoid inline JSON and shell interpolation.
- Avoid bulk mutations when an item-level endpoint can satisfy the request.

After sending, re-fetch the resource or its durable history. An HTTP success is
not sufficient when the operation dispatches asynchronous work.

## Diagnose Failures

- `Not logged in` or `login expired`: run `pnpm cli auth login`.
- `401` or `403`: verify the authenticated account and required role; do not
  work around server authorization.
- `404`: verify that the CLI path omits `/v1` and that the route is deployed.
- `409`: re-fetch; the resource may be stale, already handled, or processing.
- Validation error: inspect the OpenAPI or owning Zod input schema rather than
  adding speculative fields.
- Network failure in a sandbox: request the normal network escalation and retry
  the same bounded command.

Warnings about unrelated optional `.env.local` services may precede valid API
JSON. Judge success by the command exit status and API response, not by the
mere presence of a warning.
