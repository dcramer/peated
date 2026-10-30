# Blocked Websites

## Intent

Peated reads public whisky facts. Some websites block every automated request,
even polite ones that identify themselves, sign their requests, follow
robots.txt, and stay within low request limits. Peated reads public pages on
those websites through a bypass service. It follows robots.txt unless an admin
has made a recorded exception for one website, and it never goes past a login
or paywall.

## Terms

- A **bot wall** blocks automated requests in general, whoever sends them. A
  Cloudflare challenge page and a bot protection service's blanket HTTP 403 are
  bot walls.
- A **bypass service** reads a page in a way that gets past a bot wall. Peated
  uses Firecrawl's `auto` proxy, which tries a basic request and retries through
  its enhanced proxy when the website blocks it. These requests do not carry
  the PeatedBot user agent or signature.

## Policy

- Read and search other websites only through `@peated/bot`
  (`packages/bot`). Do not use a model provider's built-in web search, because
  it reads pages outside these rules.
- Follow robots.txt for every read, including model page-reading tools. Use the
  `PeatedBot` group, or the `*` group when no group names PeatedBot. Cache each
  website's robots.txt for 24 hours.
- Only an admin may set a robots.txt exception, and only for one website at a
  time, with a written reason.
- Scrapers send direct PeatedBot requests, signed when
  `PEATED_BOT_PRIVATE_JWK` is configured. When a direct request hits a bot wall,
  the system marks that website as blocked. Later requests to a blocked website
  go through the bypass service until an admin clears the mark. A request the
  bypass service can't send as is, such as a POST or one with an API key
  header, fails instead.
- Images and other files are read directly only, never through the bypass
  service.
- Model page-reading tools read through the bypass service.
- Never bypass logins, paywalls, member-only pages, or other access controls.
  Never send credentials or cookies through a bypass service.
- Bypassed requests count toward the same request limits, caching, and run
  limits as direct requests.
- Record whether each read went direct or through the bypass service. Do not
  record request headers or fetched bodies.
- When a website owner objects, stop reading that website and pause the source,
  as the PeatedBot page promises.

`@peated/bot` owns this rule. Its tests must show that a page robots.txt
disallows is not read without an exception, and that a login or paywall is
never bypassed.
