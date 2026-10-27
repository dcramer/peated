# PeatedBot

PeatedBot is how Peated reads and searches other websites. It reads directly
and signed when it can, and through Firecrawl when a website blocks it. Every
read follows the [blocked websites policy](../../docs/policies/blocked-websites.md).

```ts
import { createPeatedBot } from "@peated/bot";

const bot = createPeatedBot({
  cache, // short-lived values, backed by Redis on the server
  getSite, // (origin) => the caller's settings for one website
  onBotWall, // (origin) => the caller stores the website as blocked
  firecrawl: { apiKey, apiUrl }, // or null
  privateJwk, // PEATED_BOT_PRIVATE_JWK, or null to send unsigned requests
});

const page = await bot.readPage({ url, format: "markdown" });
const search = await bot.searchWeb({ query: "Lagavulin 16" });
```

## Reading a page

`readPage` returns one of three results:

- `ok`: the page, the address it ended on, and its `route`, `direct` or
  `firecrawl`.
- `refused`: PeatedBot chose not to read it. The reason says why: the address
  is invalid or not public, robots.txt disallows it or could not be read, or the
  page needs a login.
- `failed`: PeatedBot tried and did not get the page, for example a 404, a
  timeout, or Firecrawl being unavailable.

Unexpected problems, such as a rejected Firecrawl API key, throw.

Before any read, PeatedBot checks the website's robots.txt. It follows the
`PeatedBot` group, or the `*` group when no group names PeatedBot, and caches
the rules for 24 hours. A 4xx robots.txt means the website has no rules. A 5xx
or a failed request means the rules are unknown, so the page is not read. When
robots.txt itself sits behind a bot wall, PeatedBot reads it through Firecrawl.
An admin's robots.txt exception for a website skips the check.

The `format` decides the route:

- `markdown` returns the page's main text. Firecrawl always reads it, with its
  `auto` proxy.
- `html` returns the full page. PeatedBot reads it directly, with the
  `PeatedBot/1.0` user agent and a Web Bot Auth signature. When the response is
  a bot wall, PeatedBot marks the website as blocked and reads it through
  Firecrawl. Later reads of a blocked website go straight to Firecrawl.

Only specific signs count as a bot wall: a Cloudflare `cf-mitigated: challenge`
header, or a 403 with DataDome's `x-datadome` header. A plain 403 or a 401 is
never sent to Firecrawl.

Direct reads only reach public network addresses. Every new connection checks
its DNS answer, including after redirects. Each redirect is checked against
robots.txt before it is followed. Firecrawl follows redirects itself, so
PeatedBot checks the page Firecrawl ended on and drops it when robots.txt
disallows it.

## Searching

`searchWeb` returns links, titles, and descriptions from Firecrawl search. It
does not read the pages. Read a result with `readPage` to use it.

## Cache and website settings

PeatedBot does not use a database. It keeps short-lived values in `cache`, a
`BotCache` with `get` and `set`. Robots.txt rules are cached there for 24
hours. The server backs the cache with Redis; tests, evals, and local scripts
use `createMemoryCache`. A missing or damaged entry is fetched again. Errors
from the cache throw, so a server cache that should fall back when Redis is
down must do that itself.

Long-term settings for each website belong to the caller. PeatedBot asks for
them with `getSite(origin)`: whether an admin made a robots.txt exception, and
whether the website is blocked. When a direct read hits a bot wall, PeatedBot
calls `onBotWall(origin)` so the caller can store the website as blocked.

## Request signing

[PeatedBot request signing](../../docs/operations/peated-bot.md) explains how to
create, register, and rotate the signing key.
