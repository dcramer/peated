# Production Debugging

Use this playbook when production differs from local behavior or the browser
error does not identify the failing runtime.

## Production Surfaces

- frontend: `https://peated.com`, Vercel project `peated-web-next`
- API: `https://api.peated.com`, Render service `api`
- worker: Render service `worker`
- Sentry org/project: `peated` / `peated`
- Sentry web environment: `vercel-production`
- Sentry API environment: `production`

Begin with the exact route, absolute UTC timestamp, release, environment, and
browser-visible failure. A local timestamp or vague time window creates noisy
and misleading searches.

## Diagnostic Sequence

1. Find the Sentry issue and event for the affected runtime and route.
2. Capture its UTC timestamp, release, trace id, request URL, and first relevant
   Peated stack frame.
3. Inspect the trace for calls crossing from Vercel to `api.peated.com`.
4. Query Vercel logs in a narrow matching window.
5. When the web trace shows an upstream API failure, query Render request and
   application logs for the same window.
6. Look for the earliest shared failure before debugging the route that merely
   surfaced it.
7. After a fix, verify Sentry, platform logs, and the production route.

## Sentry

Useful issue searches:

```text
environment:vercel-production url:"https://peated.com/<path>"
environment:production url:"https://api.peated.com/<path>"
```

Production Next.js may redact a Server Component exception and show only a
generic message or digest in the browser. Search by route, time, and release;
do not search only for the browser text.

For a web server-render failure, inspect `http.client` spans in the trace. They
show which API call failed and the status returned to the web runtime.

## Vercel Logs

Use the Vercel CLI through `pnpm dlx` unless a local binary is already
available:

```bash
pnpm dlx vercel whoami
pnpm dlx vercel project ls --scope peated
```

Query a tight UTC window and route:

```bash
pnpm dlx vercel logs \
  --scope peated \
  --project peated-web-next \
  --environment production \
  --since <start-utc> \
  --until <end-utc> \
  --query '<route>' \
  --json \
  --limit 100
```

Broad error checks are useful only after narrowing the time:

```bash
pnpm dlx vercel logs --scope peated --project peated-web-next \
  --environment production --level error --since 30m --json

pnpm dlx vercel logs --scope peated --project peated-web-next \
  --environment production --status-code 500 --since 30m --json
```

A Vercel request may return HTTP 200 while the streamed React Server Component
payload contains a render error. A successful outer request is not proof that
server rendering completed.

## Upstream 502s

An oRPC `BAD_GATEWAY` error usually means the client received an upstream HTTP
error that was not a valid oRPC envelope. Inspect the logged response status,
body, and headers.

Headers such as `server: cloudflare`, `rndr-id`, or `x-render-routing` indicate
that Vercel received the failure from the API hosting path. Use the trace to
identify the RPC endpoint, then move to Render logs. Do not keep debugging the
web component as if it created the 502.

When many unrelated API and upload paths begin returning 502 at the same time,
search application logs for an earlier process-level error. A streaming,
storage, or unhandled-rejection failure can restart an API instance and make
otherwise unrelated routes fail during the restart window.

If a process-level error appears in Render but not Sentry, inspect shutdown and
fatal-error handling. The process must flush Sentry before exit if the event is
expected to reach Sentry reliably.

## Render Logs

Install the official `render-oss/cli`, authenticate, and select the Peated
workspace:

```bash
brew install render
render login
render workspaces --output json --confirm
render workspace set <workspace-id> --confirm
render services --output json --confirm
```

Query requests and application errors separately for the same tight window:

```bash
render logs \
  --resources <api-service-id> \
  --start <start-utc> \
  --end <end-utc> \
  --direction forward \
  --path <api-path> \
  --output json \
  --confirm \
  --limit 200

render logs \
  --resources <api-service-id> \
  --start <start-utc> \
  --end <end-utc> \
  --direction forward \
  --type app \
  --level error \
  --output json \
  --confirm \
  --limit 200
```

To test whether an incident is broader than one route:

```bash
render logs \
  --resources <api-service-id> \
  --start <start-utc> \
  --end <end-utc> \
  --direction forward \
  --type request \
  --status-code 502 \
  --output json \
  --confirm \
  --limit 200
```

Check deploy and instance changes when failures align with restarts or rollout:

```bash
render deploys list <api-service-id> --output json --confirm
render services instances <api-service-id> --output json --confirm
```

For non-interactive use, supply `RENDER_API_KEY` through the approved secret
environment. Never paste keys into documentation, commands committed to the
repository, issue bodies, or logs.

## Code Follow-Up

- Wrap a shared server loader in React `cache()` when both `generateMetadata()`
  and the page invoke the same request during one render.
- Keep noncritical server-side data fetches non-fatal only when the page has a
  useful degraded state.
- Do not swallow required route identity failures unless the UI explicitly owns
  the missing state.
- Preserve upstream status and safe trace context at runtime boundaries.
- Verify the repaired route and check that the original Sentry/log signature no
  longer occurs.

Follow [Observability](../policies/observability.md) and
[Data Redaction](../policies/data-redaction.md) when adding diagnostic context.
