# Production Debugging

Use this playbook when production behavior differs from local behavior or when
browser errors are too generic to identify the failing runtime.

## Hosts and Projects

- Frontend host: `https://peated.com`
- Production API host: `https://api.peated.com`
- Sentry org: `peated`
- Sentry project: `peated`
- Vercel org: `peated`
- Vercel web project: `peated-web-next`

Sentry environment names differ by runtime:

- Web/Vercel events use `environment:vercel-production`.
- API events use `environment:production`.

Start with the exact route, absolute timestamp, release, and browser message.
For browser reports, convert local time to UTC before searching logs.

## Sentry First

Search grouped issues for the affected runtime and route:

```bash
# Web App Router / Vercel runtime
environment:vercel-production url:"https://peated.com/<path>"

# API runtime
environment:production url:"https://api.peated.com/<path>"
```

If the browser shows a generic React Server Components message, search Sentry
for the route and release instead of the browser text. In production, Next.js
redacts Server Component exception messages before sending them to the browser.
The browser may only show a digest like:

```text
An error occurred in the Server Components render.
```

Open the Sentry issue and capture:

- Issue ID and URL.
- Event timestamp in UTC.
- Release.
- Environment.
- Request URL and route transaction.
- Trace ID.
- Most relevant first-party stack frame.

Then open the trace. For web server-render failures that call oRPC, inspect
`http.client` spans to identify which `api.peated.com/rpc/*` calls failed and
which HTTP status they returned.

## Vercel Logs

Use the Vercel CLI through `pnpm dlx` unless a local `vercel` binary is
available:

```bash
pnpm dlx vercel whoami
pnpm dlx vercel project ls --scope peated
```

Query historical production logs with a tight UTC window:

```bash
pnpm dlx vercel logs \
  --scope peated \
  --project peated-web-next \
  --environment production \
  --since 2026-07-08T14:23:00Z \
  --until 2026-07-08T14:26:00Z \
  --query '/bottles/44290/bottlings/415' \
  --json \
  --limit 100
```

Useful filters:

```bash
pnpm dlx vercel logs --scope peated --project peated-web-next \
  --environment production --level error --since 30m --json

pnpm dlx vercel logs --scope peated --project peated-web-next \
  --environment production --status-code 500 --since 30m --json
```

Vercel `responseStatusCode` is the HTTP status returned by the web route. App
Router can return `200` while logging a Server Component render error that is
later surfaced to the browser through the RSC payload. Do not treat a `200`
Vercel request line as proof that server render succeeded.

## oRPC Bad Gateway

An oRPC `Error: Bad Gateway` from the web app means the oRPC client received an
HTTP error response and could not decode a valid oRPC error envelope.

The important fields are inside the logged error:

```text
code: 'BAD_GATEWAY'
status: 502
data: {
  body: undefined,
  headers: { ... }
}
```

If the headers include values like these, the failure is upstream of the web
server:

```text
server: cloudflare
rndr-id: ...
x-render-routing: dynamic-paid-error
content-type: text/html; charset=utf-8
```

That means the web app received a literal HTTP 502 from `api.peated.com`, but
the original API/runtime exception was hidden behind an HTML error response.
Use the Sentry trace to identify the affected RPC endpoint, then inspect API
logs or API Sentry events around the same UTC timestamp.

## Render API Logs

The API service runs on Render. Use this when Vercel logs show upstream headers
such as `rndr-id` or `x-render-routing`.

Render also provides an official CLI from `render-oss/cli`; it is not an npm
package. Install it with Homebrew or the official install script:

```bash
brew update
brew install render
```

```bash
curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh
```

Authenticate interactively:

```bash
render login
```

Select the Peated workspace before listing services or logs:

```bash
render workspaces --output json --confirm
render workspace set <workspace-id> --confirm
```

Find service IDs:

```bash
render services --output json --confirm
```

Current production service names:

- API web service: `api`
- Worker service: `worker`

Query API request logs for a tight UTC window:

```bash
render logs \
  --resources <api-service-id> \
  --start 2026-07-08T14:23:00Z \
  --end 2026-07-08T14:26:00Z \
  --direction forward \
  --path /rpc/bottles/details,/rpc/bottleReleases/details \
  --output json \
  --confirm \
  --limit 200
```

Query app errors in the same window:

```bash
render logs \
  --resources <api-service-id> \
  --start 2026-07-08T14:24:10Z \
  --end 2026-07-08T14:24:40Z \
  --direction forward \
  --type app \
  --level error \
  --output json \
  --confirm \
  --limit 200
```

Query 502s across all paths:

```bash
render logs \
  --resources <api-service-id> \
  --start 2026-07-08T14:24:10Z \
  --end 2026-07-08T14:24:40Z \
  --direction forward \
  --type request \
  --status-code 502 \
  --output json \
  --confirm \
  --limit 200
```

Check deploys and current instances:

```bash
render deploys list <api-service-id> --output json --confirm
render services instances <api-service-id> --output json --confirm
```

Useful filters supported by Render logs include:

- `resource`: service, cron job, job, Postgres, Redis, or workflow ID.
- `instance`: specific running instance ID.
- `host`: request host.
- `statusCode`: request status code, including wildcard or regex patterns.
- `method`: request method.
- `level`: application log severity.
- `type`: `app`, `request`, or `build`.
- `text`: text search against log messages.
- `path`: request path.

For incidents like `PEATED-48Z`, query both request logs and app logs around the
same timestamp. Request logs confirm the HTTP status and path; app logs are more
likely to contain the original stack trace or process-level failure that caused
Render to return an HTML 502 response.

For non-interactive REST API use, set `RENDER_API_KEY`. The CLI uses that API
key before locally saved CLI tokens:

```bash
export RENDER_API_KEY=rnd_...
render services --output json --confirm
```

The REST API can fetch the same log data when CLI output needs custom paging:

```bash
curl -sS "https://api.render.com/v1/logs?ownerId=$RENDER_OWNER_ID&resource=$RENDER_API_SERVICE_ID&startTime=2026-07-08T14:23:00Z&endTime=2026-07-08T14:26:00Z&direction=forward&path=/rpc/bottles/details&statusCode=502&type=request&limit=100" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Accept: application/json" \
  | jq
```

## Incident Notes

On July 8, 2026, a bottling page failure appeared in the browser as a generic
RSC error. Sentry issue `PEATED-48Z` showed the real web exception:

- Route: `GET /bottles/[bottleId]/bottlings/[bottlingId]`
- URL: `https://peated.com/bottles/44290/bottlings/415`
- Release: `c1c2742b7dcac73eb13cb5436ef3ac8cd97c9c3a`
- Trace ID: `3d4c25c0164df2bab2036b321729b166`
- Time: `2026-07-08T14:24:21Z`

The trace showed server-side RPC calls to:

- `POST https://api.peated.com/rpc/bottles/details`
- `POST https://api.peated.com/rpc/bottleReleases/details`

Both returned HTTP 502. Vercel logs for `peated-web-next` confirmed the web
route logged `Error: Bad Gateway` while the web request itself returned `200`.
The upstream response headers included Cloudflare and Render headers, including
`x-render-routing: dynamic-paid-error`, so the next root-cause step was API
host/log inspection, not further web route debugging.

Render request logs showed a burst of HTTP 502s across many API paths starting
at `2026-07-08T14:24:17Z`, including `/uploads/*`, `/rpc/bottles/details`, and
`/rpc/bottleReleases/details`. API app logs at the same time showed both live
instances logging an unhandled rejection:

```text
Error [ERR_STREAM_UNABLE_TO_PIPE]: Cannot pipe to a closed or destroyed stream
```

The stack pointed at `@google-cloud/storage` while serving `/uploads/*`. The API
process exits on unhandled rejections, so this kind of upload stream failure can
restart instances and make unrelated RPC endpoints return Render 502s during the
restart window. When request logs show 502s across unrelated endpoints, look for
the earliest app-level process error rather than assuming the route named in the
browser error is the root cause.

If Render shows a process-level error that does not appear in Sentry, inspect
the shutdown path. The API must flush Sentry before `process.exit(1)`, otherwise
captured unhandled rejections can be visible in Render logs but missing from
Sentry issues.

## Code Follow-Up Checklist

- If a page calls the same server loader from both `generateMetadata()` and the
  page component, wrap the shared loader in React `cache()` to dedupe identical
  work during a render request.
- Keep noncritical server-side data fetches non-fatal when the page can still
  render useful content without them.
- Do not swallow required route identity fetches, such as primary bottle or
  entity details, unless the UI has an explicit degraded state.
- After a fix, verify with Sentry issue search, trace search, Vercel logs, and
  a browser or curl request to the production route.
