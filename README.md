# Peated

The application that powers peated.com.

For more details, take a look at <https://peated.com/about>

A Discord is available if you want to contribute: <https://discord.gg/d7GFPfy88Z>

## Features

### Rating Systems

Peated uses a three-choice tasting rating:

- **Pass**: Would not drink again
- **Sip**: Enjoyable; would have sometimes
- **Savor**: Excellent; would seek out

Historical five-star values are retained as migration data, not as a second
rating choice. See the
[Rating Systems Architecture](./docs/architecture/rating-systems.md).

## Dev

Setup the required frameworks:

1. [pnpm](https://pnpm.io/installation)
2. [Docker](https://docs.docker.com/get-docker/) (with Docker Compose)

Bootstrap the environment:

```bash
docker compose up -d
pnpm install
```

Local Postgres is published on `localhost:15432` and Redis is published on
`localhost:16379` to avoid colliding with other default local instances. The
tracked local test database config in `apps/server/.env.test` uses the same
host ports.

Copy the example environment file into your local-only configuration:

```bash
cp .env.example .env.local
```

`.env.local` is ignored and is copied into Codex-managed worktrees through
`.worktreeinclude`.

For the Codex local environment setup script, use:

```bash
test -f .env.local || cp .env.example .env.local
SKIP_INSTALL_SIMPLE_GIT_HOOKS=1 pnpm install --frozen-lockfile
```

Git hooks are shared with the primary checkout, so worktrees do not need to
install them again.

Setup the database:

```bash
make create-db
pnpm db:migrate
```

Create a local user to avoid setting up Google credentials:

```bash
pnpm cli users create you@example.com password -a -v
```

Load some mock data:

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

The web app runs on Vercel and the API and worker run on Render. Use the
[Production Debugging](./docs/development/production-debugging.md) playbook for
current hosts, logs, traces, and diagnostic commands.

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
