# Deployments

Peated production has three parts:

- Vercel runs the web frontend at `https://peated.com`.
- Render runs the API at `https://api.peated.com` and the worker.
- PlanetScale hosts the production database.

The API and worker use `VERSION` as their release identifier when it is non-empty.
Otherwise, they use Render's `RENDER_GIT_COMMIT`. The API exposes this value at
`/v1/version`, and both services use it for Sentry releases.

Before a deploy, identify which parts change and whether they must remain
compatible during the rollout. Never assume that a database, API, worker, and
web change become active at the same time.

After a deploy, check the changed user flow and the affected production parts.
Use [Production Debugging](./production-debugging.md) for logs and traces.
