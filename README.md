# Peated

Peated is a public record of whisky. Our goal is to document as much whisky as
possible and make that data freely accessible to everyone.

Browse the catalog at <https://peated.com> or read it through the public API at
<https://peated.com/about/api>.

A Discord is available if you want to contribute: <https://discord.gg/d7GFPfy88Z>

See the [documentation guide](./docs/README.md) for architecture, feature,
development, operations, policy, and research documents.

## Features

### Rating Systems

Peated uses five tasting bands from Mediocre through Unicorn. Reviews use a
score from 0 through 100. Old Pass, Sip, Savor, and star ratings remain only on
historical tastings. See the
[Rating Systems Architecture](./docs/architecture/ratings.md).

## Dev

Set up the required tools:

1. [pnpm](https://pnpm.io/installation)
2. [Docker](https://docs.docker.com/get-docker/) (with Docker Compose)

Bootstrap the environment:

```bash
docker compose up -d
pnpm run setup:local
```

Local Postgres is published on `localhost:15432` and Redis is published on
`localhost:16379` to avoid colliding with other default local instances. The
tracked local test database config in `apps/server/.env.test` uses the same
host ports.

The setup command copies the example environment file into your local-only
configuration when it does not already exist. To do only that step, run:

```bash
pnpm run setup:env
```

`.env.local` is ignored and is copied into Codex-managed worktrees through
`.worktreeinclude`.

To work on the UI without Postgres, Redis, or sample data, run:

```bash
pnpm dev:mock
```

This starts the web app with a local API that returns fixed examples. It does
not need Postgres or Redis. Open `http://localhost:3200`. You can sign in with
any valid email address and any password. If the UI calls an unsupported API
route, that request returns `404`.

Codex uses the same `setup:local` command when it creates a worktree. Git hooks
are shared with the primary checkout, so the Codex environment skips installing
them again. Codex also has buttons to run the app without the database or check
the code.

Run the same code checks used before review:

```bash
pnpm check
```

This checks formatting and common code problems. It does not run all tests.

Setup the database:

```bash
make create-db
pnpm db:migrate
```

Create a local user to avoid setting up Google credentials:

```bash
pnpm cli users create you@example.com password -a -v
```

Load sample data when you need to develop against the real API:

```bash
pnpm cli mocks load-all you@example.com
```

Run the dev server, which spins up the `web`, API, and worker services:

```bash
pnpm dev
```

The worker requires Redis. The default local Redis URL is
`redis://@localhost:16379`, matching `docker-compose.yml`. For API-only local
checks, use `pnpm dev:server:api`.

## Operations

See [Deployments](./docs/operations/deployments.md) for the production service
map and [Production Debugging](./docs/operations/production-debugging.md) for
logs, traces, and diagnostic commands.

### Authenticated API maintenance

The CLI can authorize against production without storing a password. The
checked-in public OAuth client uses the registered redirect URI
`http://127.0.0.1/oauth/callback`. `PEATED_OAUTH_CLIENT_ID` or the login
command's `--client-id` option can override that client for another deployment.

Log in and inspect the current credential with:

```bash
pnpm cli auth login
pnpm cli auth status
```

The CLI chooses an available callback port and stores the seven-day bearer token
in `$XDG_CONFIG_HOME/peated/credentials.json`, or `~/.config/peated` when
`XDG_CONFIG_HOME` is unset. It never prints the token.

Authenticated API reads produce JSON. Mutations require an interactive
confirmation or an explicit `--yes`, and JSON bodies are read from files:

```bash
pnpm cli api get /bottles/123
pnpm cli api patch /bottles/123 --input ./change.json --yes
pnpm cli auth logout
```

Use the [Catalog Maintenance](./docs/operations/catalog-maintenance.md) workflow
for researched Bottle backfills, deduplication, and verified batch edits.
