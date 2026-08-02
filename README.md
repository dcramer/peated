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

Note: If you need to tweak default settings, `cp .env.example .env` and go to town.

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
