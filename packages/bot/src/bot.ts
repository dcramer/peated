import {
  fetchPublicUrl,
  hasNonPublicLiteralAddress,
  isPublicAddressError,
} from "./address";
import {
  type FirecrawlConfig,
  scrapeWithFirecrawl,
  type SearchResult,
  searchWithFirecrawl,
} from "./firecrawl";
import { BOT_USER_AGENT } from "./identity";
import {
  parseRobotsRules,
  ROBOTS_CACHE_MS,
  ROBOTS_MAX_BYTES,
  robotsAllowsUrl,
  type RobotsRules,
} from "./robots";
import { signRequest } from "./signing";
import { type BotSiteStore, NEW_BOT_SITE } from "./sites";

const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_SEARCH_LIMIT = 8;

/**
 * `markdown` returns a page's main text, read through Firecrawl. `html`
 * returns the page's full HTML, read directly unless the website blocks
 * PeatedBot.
 */
export type PageFormat = "markdown" | "html";

export type PageRead =
  | {
      status: "ok";
      /** The page that was read, after redirects. */
      url: string;
      title: string | null;
      content: string;
      /** Direct PeatedBot request, or Firecrawl. */
      route: "direct" | "firecrawl";
    }
  | {
      /** PeatedBot chose not to read the page. */
      status: "refused";
      url: string;
      reason:
        | "invalid_url"
        | "not_public"
        | "robots_disallowed"
        | "robots_unavailable"
        | "login_required";
    }
  | {
      /** PeatedBot tried and did not get the page. */
      status: "failed";
      url: string;
      reason:
        | "not_found"
        | "blocked"
        | "http_error"
        | "too_large"
        | "timeout"
        | "transport"
        | "too_many_redirects"
        | "service_unavailable";
      httpStatus: number | null;
    };

export type WebSearch =
  | { status: "ok"; results: SearchResult[] }
  | {
      status: "failed";
      reason: "service_unavailable";
      httpStatus: number | null;
    };

type DirectOutcome =
  | { kind: "ok"; url: URL; body: string }
  | { kind: "bot_wall"; url: URL }
  | { kind: "status"; url: URL; status: number }
  | {
      kind: "error";
      url: URL;
      reason:
        | "not_public"
        | "timeout"
        | "transport"
        | "too_large"
        | "too_many_redirects";
    }
  | { kind: "refused"; read: PageRead };

/**
 * Bot wall signs. Only specific markers count, so a plain 403 or a login page
 * is never sent to the bypass service (blocked websites policy).
 */
function isBotWall(status: number, headers: Headers) {
  if (headers.get("cf-mitigated")?.toLowerCase() === "challenge") return true;
  if (status === 403 && headers.has("x-datadome")) return true;
  return false;
}

function parseReadableUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // Never send credentials, even ones written into the address.
  if (url.username || url.password) return null;
  url.hash = "";
  return url;
}

async function discard(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Cancelling an unread body is best effort.
  }
}

/**
 * Reads at most `maxBytes`. A longer body is cut off when `truncate` is set,
 * and rejected with null otherwise.
 */
async function readBody(
  response: Response,
  maxBytes: number,
  { truncate }: { truncate: boolean },
): Promise<string | null> {
  const length = Number(response.headers.get("content-length"));
  if (!truncate && Number.isFinite(length) && length > maxBytes) {
    await discard(response);
    return null;
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      await reader.cancel();
      if (!truncate) return null;
      chunks.push(value.subarray(0, maxBytes - total));
      total = maxBytes;
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

/** Robots.txt read through Firecrawl may come back wrapped in HTML. */
function robotsText(body: string) {
  if (!body.trimStart().startsWith("<")) return body;
  const preformatted = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(body)?.[1] ?? body;
  return preformatted
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Creates PeatedBot's page reader and web search. Every read follows the
 * blocked websites policy in `docs/policies/blocked-websites.md`.
 */
export function createPeatedBot({
  sites,
  firecrawl,
  privateJwk,
  fetch: fetchOverride,
  now = () => new Date(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
}: {
  sites: BotSiteStore;
  /** Required for markdown reads, search, and reading past a bot wall. */
  firecrawl: FirecrawlConfig | null;
  /** The `PEATED_BOT_PRIVATE_JWK` secret. Requests stay unsigned without it. */
  privateJwk: string | null;
  /** Replaces both the direct and the Firecrawl transport, for tests. */
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  maxBytes?: number;
}) {
  const directFetch = fetchOverride ?? fetchPublicUrl;
  const serviceFetch = fetchOverride ?? fetch;

  async function getSite(origin: string) {
    return (await sites.get(origin)) ?? NEW_BOT_SITE;
  }

  async function fetchDirect(
    start: URL,
    {
      accept,
      limit,
      truncate,
      beforeRedirect,
    }: {
      accept: string;
      limit: number;
      truncate: boolean;
      beforeRedirect?: (url: URL) => Promise<PageRead | null>;
    },
  ): Promise<DirectOutcome> {
    let url = start;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      if (hasNonPublicLiteralAddress(url)) {
        return { kind: "error", url, reason: "not_public" };
      }
      if (redirect > 0 && beforeRedirect) {
        const refusal = await beforeRedirect(url);
        if (refusal) return { kind: "refused", read: refusal };
      }

      let response: Response;
      try {
        response = await directFetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
          headers: await signRequest({
            url,
            headers: { Accept: accept, "User-Agent": BOT_USER_AGENT },
            created: now(),
            privateJwk,
          }),
        });
      } catch (error) {
        if (error instanceof Error && isPublicAddressError(error)) {
          return { kind: "error", url, reason: "not_public" };
        }
        if (
          error instanceof DOMException &&
          (error.name === "TimeoutError" || error.name === "AbortError")
        ) {
          return { kind: "error", url, reason: "timeout" };
        }
        return { kind: "error", url, reason: "transport" };
      }

      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        await discard(response);
        const next = parseReadableUrl(new URL(location, url).href);
        if (!next) return { kind: "status", url, status: response.status };
        url = next;
        continue;
      }
      if (isBotWall(response.status, response.headers)) {
        await discard(response);
        return { kind: "bot_wall", url };
      }
      if (!response.ok) {
        await discard(response);
        return { kind: "status", url, status: response.status };
      }
      let body: string | null;
      try {
        body = await readBody(response, limit, { truncate });
      } catch {
        return { kind: "error", url, reason: "transport" };
      }
      if (body === null) return { kind: "error", url, reason: "too_large" };
      return { kind: "ok", url, body };
    }
    return { kind: "error", url, reason: "too_many_redirects" };
  }

  async function fetchRobotsRules(
    origin: URL,
  ): Promise<RobotsRules | "unavailable" | "not_public"> {
    const robotsUrl = new URL("/robots.txt", origin);
    const outcome = await fetchDirect(robotsUrl, {
      accept: "text/plain,*/*;q=0.1",
      limit: ROBOTS_MAX_BYTES,
      truncate: true,
    });
    if (outcome.kind === "ok") return parseRobotsRules(outcome.body);
    // Robots rule (RFC 9309 section 2.3.1.3): a 4xx answer means the website
    // publishes no rules. A 5xx answer or a failed request means the rules are
    // unknown, so PeatedBot does not read the page.
    if (outcome.kind === "status") {
      if (outcome.status >= 400 && outcome.status < 500) {
        return { status: "missing" };
      }
      return "unavailable";
    }
    if (outcome.kind === "error" && outcome.reason === "not_public") {
      return "not_public";
    }
    // A bot wall's 403 is not the owner's answer, so read the real file
    // through Firecrawl before reading anything else on the website.
    if (outcome.kind === "bot_wall" && firecrawl) {
      const page = await scrapeWithFirecrawl(
        firecrawl,
        serviceFetch,
        robotsUrl,
        "rawHtml",
      );
      if (!page.ok || page.httpStatus === null) return "unavailable";
      if (page.httpStatus >= 400 && page.httpStatus < 500) {
        return { status: "missing" };
      }
      if (page.httpStatus >= 300) return "unavailable";
      return parseRobotsRules(robotsText(page.content));
    }
    return "unavailable";
  }

  /** Returns a refusal, or null when robots.txt allows reading `url`. */
  async function checkRobots(url: URL): Promise<PageRead | null> {
    const site = await getSite(url.origin);
    // Robots.txt exceptions are recorded by an admin for one website.
    if (site.robotsException) return null;

    let rules =
      site.robots && site.robots.expiresAt > now() ? site.robots.rules : null;
    if (!rules) {
      const fetched = await fetchRobotsRules(url);
      if (fetched === "not_public") {
        return { status: "refused", url: url.href, reason: "not_public" };
      }
      if (fetched === "unavailable") {
        return {
          status: "refused",
          url: url.href,
          reason: "robots_unavailable",
        };
      }
      rules = fetched;
      await sites.saveRobots(
        url.origin,
        rules,
        new Date(now().getTime() + ROBOTS_CACHE_MS),
      );
    }
    if (!robotsAllowsUrl(rules, url)) {
      return { status: "refused", url: url.href, reason: "robots_disallowed" };
    }
    return null;
  }

  async function readWithFirecrawl(
    url: URL,
    format: PageFormat,
  ): Promise<PageRead> {
    if (!firecrawl) {
      return {
        status: "failed",
        url: url.href,
        reason: "blocked",
        httpStatus: null,
      };
    }
    const page = await scrapeWithFirecrawl(
      firecrawl,
      serviceFetch,
      url,
      format === "markdown" ? "markdown" : "rawHtml",
    );
    if (!page.ok) {
      return {
        status: "failed",
        url: url.href,
        reason: "service_unavailable",
        httpStatus: page.httpStatus,
      };
    }
    const status = page.httpStatus;
    if (status === 401) {
      return { status: "refused", url: url.href, reason: "login_required" };
    }
    if (status === 404 || status === 410) {
      return {
        status: "failed",
        url: url.href,
        reason: "not_found",
        httpStatus: status,
      };
    }
    if (status !== null && status >= 400) {
      return {
        status: "failed",
        url: url.href,
        reason: status === 403 ? "blocked" : "http_error",
        httpStatus: status,
      };
    }
    // Firecrawl follows redirects itself, so check where it ended up and drop
    // the page when robots.txt disallows it.
    const finalUrl = parseReadableUrl(page.url) ?? url;
    if (finalUrl.href !== url.href) {
      if (hasNonPublicLiteralAddress(finalUrl)) {
        return { status: "refused", url: finalUrl.href, reason: "not_public" };
      }
      const refusal = await checkRobots(finalUrl);
      if (refusal) return refusal;
    }
    if (page.content.length > maxBytes) {
      return {
        status: "failed",
        url: finalUrl.href,
        reason: "too_large",
        httpStatus: status,
      };
    }
    return {
      status: "ok",
      url: finalUrl.href,
      title: page.title,
      content: page.content,
      route: "firecrawl",
    };
  }

  async function readDirect(url: URL): Promise<PageRead> {
    const outcome = await fetchDirect(url, {
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      limit: maxBytes,
      truncate: false,
      beforeRedirect: checkRobots,
    });
    switch (outcome.kind) {
      case "ok":
        return {
          status: "ok",
          url: outcome.url.href,
          title: null,
          content: outcome.body,
          route: "direct",
        };
      case "refused":
        return outcome.read;
      case "bot_wall":
        await sites.markBlocked(outcome.url.origin, now());
        return await readWithFirecrawl(url, "html");
      case "status":
        if (outcome.status === 401) {
          return {
            status: "refused",
            url: outcome.url.href,
            reason: "login_required",
          };
        }
        return {
          status: "failed",
          url: outcome.url.href,
          reason:
            outcome.status === 404 || outcome.status === 410
              ? "not_found"
              : "http_error",
          httpStatus: outcome.status,
        };
      case "error":
        if (outcome.reason === "not_public") {
          return {
            status: "refused",
            url: outcome.url.href,
            reason: "not_public",
          };
        }
        return {
          status: "failed",
          url: outcome.url.href,
          reason: outcome.reason,
          httpStatus: null,
        };
    }
  }

  /** Reads one public page under robots.txt and the blocked websites policy. */
  async function readPage({
    url: value,
    format,
  }: {
    url: string;
    format: PageFormat;
  }): Promise<PageRead> {
    const url = parseReadableUrl(value);
    if (!url) return { status: "refused", url: value, reason: "invalid_url" };
    if (hasNonPublicLiteralAddress(url)) {
      return { status: "refused", url: url.href, reason: "not_public" };
    }
    if (format === "markdown" && !firecrawl) {
      throw new Error("PeatedBot needs Firecrawl to read pages as markdown.");
    }

    const refusal = await checkRobots(url);
    if (refusal) return refusal;

    if (format === "markdown") return await readWithFirecrawl(url, format);
    const site = await getSite(url.origin);
    if (site.blockedAt) return await readWithFirecrawl(url, format);
    return await readDirect(url);
  }

  /** Searches the web. Results are links only; read a page to use it. */
  async function searchWeb({
    query,
    limit = DEFAULT_SEARCH_LIMIT,
  }: {
    query: string;
    limit?: number;
  }): Promise<WebSearch> {
    if (!firecrawl) {
      throw new Error("PeatedBot needs Firecrawl to search the web.");
    }
    const result = await searchWithFirecrawl(
      firecrawl,
      serviceFetch,
      query,
      limit,
    );
    if (!result.ok) {
      return {
        status: "failed",
        reason: "service_unavailable",
        httpStatus: result.httpStatus,
      };
    }
    return { status: "ok", results: result.results };
  }

  return { readPage, searchWeb };
}
