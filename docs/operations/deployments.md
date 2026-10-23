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

## Vercel firewall

Vercel bot protection challenges requests that do not come from a browser.
Apple fetches `https://peated.com/.well-known/apple-app-site-association`
through its own servers. That file must load without a challenge, or passkeys
in the iOS app stop working.

The firewall rule lives in Vercel, not in this repository. `vercel.json` can
add challenge or deny rules, but it cannot skip one. Keep this custom rule on
the `peated-web` project:

- Condition: request path equals `/.well-known/apple-app-site-association`.
- Action: Bypass.

After you change the firewall, check the file:

```bash
curl -sSI https://peated.com/.well-known/apple-app-site-association
```

Require HTTP 200, `Content-Type: application/json`, and no
`x-vercel-mitigated` header. Apple's servers cache the file, so a fix can take
up to a day to reach devices. To see Apple's cached copy, open
`https://app-site-association.cdn-apple.com/a/v1/peated.com`.
