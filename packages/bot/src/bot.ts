import { z } from "zod";
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
  RobotsRulesSchema,
} from "./robots";
import { signRequest } from "./signing";
import type { BotCache, BotSiteSettings } from "./sites";

const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_SEARCH_LIMIT = 8;
// Repeat reads of one page within an hour reuse the first read instead of
// spending another Firecrawl credit. Very large pages are not cached.
const PAGE_CACHE_MS = 60 * 60_000;
const PAGE_CACHE_MAX_CHARS = 1_000_000;

const PageReadOkSchema = z.object({
  status: z.literal("ok"),
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  publishedTime: z.string().nullable(),
  content: z.string(),
  route: z.enum(["direct", "firecrawl"]),
});

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
      /** The page's summary from its metadata, when Firecrawl reports one. */
      description: string | null;
      /** The page's published date or time, when Firecrawl reports one. */
      publishedTime: string | null;
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

function parseReadableUrl(value: string, base?: URL) {
  let url: URL;
  try {
    url = new URL(value, base);
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

/**
 * Robots rule (RFC 9309 section 2.3.1.3): a 4xx robots.txt answer means the
 * website publishes no rules. 408 and 429 only mean "try later", so they leave
 * the rules unknown instead.
 */
function isMissingRobotsStatus(status: number) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/**
 * Robots.txt read through Firecrawl may come back as plain text or wrapped in
 * a `<pre>` element. Any other HTML is not a robots.txt file, such as a
 * challenge page, so it returns null.
 */
function robotsText(body: string) {
  if (!body.trimStart().startsWith("<")) return body;
  const preformatted = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(body)?.[1];
  if (preformatted === undefined) return null;
  return preformatted
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function robotsCacheKey(origin: string) {
  return `peatedbot:robots:${origin}`;
}

function pageCacheKey(format: PageFormat, url: URL) {
  return `peatedbot:page:${format}:${url.href}`;
}

/** A damaged cache entry reads as missing and is fetched again. */
function parseCached<T>(value: string, schema: z.ZodType<T>): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Creates PeatedBot's page reader and web search. Every read follows the
 * blocked websites policy in `docs/policies/blocked-websites.md`.
 */
export function createPeatedBot({
  cache,
  getSite,
  onBotWall,
  firecrawl,
  privateJwk,
  fetch: fetchOverride,
  now = () => new Date(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
}: {
  /** Holds robots.txt rules for 24 hours. */
  cache: BotCache;
  /** Looks up a website's settings, which the caller stores. */
  getSite: (origin: string) => Promise<BotSiteSettings>;
  /**
   * Called when a direct read of `origin` hits a bot wall. The caller should
   * store the website as blocked so later reads go through Firecrawl.
   */
  onBotWall: (origin: string) => Promise<void>;
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

      // A bad signing key is a deployment problem, so signing stays outside
      // the catch that turns network failures into results.
      const headers = await signRequest({
        url,
        headers: { Accept: accept, "User-Agent": BOT_USER_AGENT },
        created: now(),
        privateJwk,
      });
      let response: Response;
      try {
        response = await directFetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
          headers,
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
        const next = parseReadableUrl(location, url);
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
    // A 5xx answer or a failed request leaves the rules unknown, so PeatedBot
    // does not read the page.
    if (outcome.kind === "status") {
      return isMissingRobotsStatus(outcome.status)
        ? { status: "missing" }
        : "unavailable";
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
      // Through Firecrawl, only a 404 or 410 says the file does not exist.
      // Any other failure, or a page that is not a robots.txt file, may be the
      // bot wall again, so the rules stay unknown.
      if (!page.ok || page.httpStatus === null) return "unavailable";
      if (page.httpStatus === 404 || page.httpStatus === 410) {
        return { status: "missing" };
      }
      if (page.httpStatus >= 300) return "unavailable";
      const body = robotsText(page.content);
      return body === null ? "unavailable" : parseRobotsRules(body);
    }
    return "unavailable";
  }

  async function getCachedPage(key: string) {
    const cached = await cache.get(key);
    if (cached === null) return null;
    return parseCached(cached, PageReadOkSchema);
  }

  async function getCachedRobotsRules(origin: string) {
    const cached = await cache.get(robotsCacheKey(origin));
    if (cached === null) return null;
    return parseCached(cached, RobotsRulesSchema);
  }

  /** Returns a refusal, or null when robots.txt allows reading `url`. */
  async function checkRobots(
    url: URL,
    site?: BotSiteSettings,
  ): Promise<PageRead | null> {
    const settings = site ?? (await getSite(url.origin));
    // Robots.txt exceptions are recorded by an admin for one website.
    if (settings.robotsException) return null;

    let rules: RobotsRules | null = await getCachedRobotsRules(url.origin);
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
      await cache.set(
        robotsCacheKey(url.origin),
        JSON.stringify(rules),
        ROBOTS_CACHE_MS,
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
        // Firecrawl answers 403 for websites it will not read.
        reason: page.httpStatus === 403 ? "blocked" : "service_unavailable",
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
      description: page.description,
      publishedTime: page.publishedTime,
      content: page.content,
      route: "firecrawl",
    };
  }

  async function readDirect(url: URL): Promise<PageRead> {
    const outcome = await fetchDirect(url, {
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      limit: maxBytes,
      truncate: false,
      beforeRedirect: (next) => checkRobots(next),
    });
    switch (outcome.kind) {
      case "ok":
        return {
          status: "ok",
          url: outcome.url.href,
          title: null,
          description: null,
          publishedTime: null,
          content: outcome.body,
          route: "direct",
        };
      case "refused":
        return outcome.read;
      case "bot_wall":
        await onBotWall(outcome.url.origin);
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

    const site = await getSite(url.origin);
    const refusal = await checkRobots(url, site);
    if (refusal) return refusal;

    const cacheKey = pageCacheKey(format, url);
    const cached = await getCachedPage(cacheKey);
    if (cached) return cached;

    const page =
      format === "markdown" || site.blocked
        ? await readWithFirecrawl(url, format)
        : await readDirect(url);
    if (page.status === "ok" && page.content.length <= PAGE_CACHE_MAX_CHARS) {
      await cache.set(cacheKey, JSON.stringify(page), PAGE_CACHE_MS);
    }
    return page;
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

export type PeatedBot = ReturnType<typeof createPeatedBot>;
