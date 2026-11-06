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

## Google Cloud credentials

The API and the worker on Render share one Google Cloud service account key.
It is the JSON key file, stored whole in `GCP_CREDENTIALS`. They use it for:

- uploads, including photos, Bottle and Entity images, price images, and
  badges, in the bucket named by `GCS_BUCKET_NAME`, under `GCS_BUCKET_PATH`
  when that is set. Storage is used only when `USE_GCS_STORAGE` is set;
- pronunciation audio, through Google Text-to-Speech.

If Google deletes or suspends the key, for example after it finds the key
exposed, uploads fail with `invalid_grant: Invalid JWT Signature`.
`GET /uploads/*` returns 500, and jobs that write images fail. Nothing in
Peated changes, so the error starts between deploys.

To replace the key:

1. In Google Cloud, open IAM & Admin → Service Accounts in the Peated
   project. The account is the `client_email` in the current key. On its Keys
   tab, create a JSON key.
2. In Render, set `GCP_CREDENTIALS` to the new key's JSON on both the API and
   the worker, and redeploy both.
3. Delete the old key in Google Cloud.
4. Check that an existing upload loads, for example
   `curl -sS -o /dev/null -w "%{http_code}\n" https://api.peated.com/uploads/<file>`
   returns `200`, and that the Sentry issue for the error gets no new events.

Never commit the key, or paste it into a ticket, chat, or log.
