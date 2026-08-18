# Authenticated API

## Auth

```bash
pnpm cli auth status
pnpm cli auth login --no-open
pnpm cli auth logout
```

For agent login, start one listener, give the user its URL, and resume that same
process after approval. Credentials expire after seven days and are stored in
`$XDG_CONFIG_HOME/peated/credentials.json` or `~/.config/peated/credentials.json`.

Defaults: API `https://api.peated.com`; web `https://peated.com`. Confirm server
overrides before writes.

## Requests

```bash
pnpm cli api get /bottles/123
pnpm cli api get '/prices/match-queue?kind=create_new&limit=25'
pnpm cli api post /path --input /tmp/peated-request.json
pnpm cli api patch /path --input /tmp/peated-request.json
pnpm cli api delete /path
```

- Omit `/v1`; the client adds it.
- Start paths with one slash; quote query strings.
- Validate writes against `https://api.peated.com/spec.json` or the owning route.
- Put JSON bodies in temporary files.
- Use `--yes` non-interactively only after explicit authorization.
- Re-fetch after success; verify asynchronous effects separately.

## Failures

| Result                | Action                                      |
| --------------------- | ------------------------------------------- |
| Login missing/expired | Run `pnpm cli auth login`                   |
| `401`/`403`           | Verify account and role; do not bypass auth |
| `404`                 | Check deployment and omit `/v1`             |
| `409`                 | Re-fetch; do not replay stale input         |
| Validation error      | Inspect OpenAPI or the route schema         |

Optional-service warnings may precede valid JSON. Use exit status and API
response to determine success.
