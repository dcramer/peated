import {
  type BotResponse,
  createMemoryCache,
  hasNonPublicLiteralAddress,
  type PeatedBot,
  type RobotsCheck,
} from "@peated/bot";
import config from "@peated/server/config";
import { createServerPeatedBot } from "@peated/server/lib/peatedBot";
import {
  acquireScrapePermit,
  type PermitDenialReason,
  recordScrapeBypassRequest,
  recordScrapeRateLimit,
  recordScrapeRequestError,
  releaseScrapePermit,
} from "./coordinator";
import { resolveScraperOrigin } from "./definitions";
import { getScraperRobotsMode, ScraperRobotsDeniedError } from "./robots";
import type { ScraperRegistry, ScraperRequest, ScraperResponse } from "./types";

const MAX_REDIRECTS = 5;
const ROBOTS_UNAVAILABLE_RETRY_MS = 15 * 60_000;
const RETRY_BASE_DELAY_MS = 250;
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;
const SAFE_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "if-modified-since",
  "if-none-match",
  "referer",
  "content-type",
]);
const EXPOSED_RESPONSE_HEADERS = new Set([
  "content-type",
  "etag",
  "last-modified",
  "link",
]);

export type ScraperWaitReason =
  | PermitDenialReason
  | "rate_limited"
  | "robots_unavailable";

export class ScraperRequestWaitError extends Error {
  override name = "ScraperRequestWaitError";

  constructor(
    readonly reason: ScraperWaitReason,
    readonly nextEligibleAt: Date | null,
    readonly resumeUrl: URL | null = null,
  ) {
    super(`Scraper request must wait: ${reason}.`);
  }
}

export class ScraperHttpStatusError extends Error {
  override name = "ScraperHttpStatusError";

  constructor(
    readonly status: number,
    readonly url: URL,
    readonly headers: Readonly<Record<string, string>>,
  ) {
    super(`Scraper request returned HTTP ${status}.`);
  }

  /** The page is gone (404 or 410), so a crawl skips it instead of failing. */
  get isMissingPage() {
    return this.status === 404 || this.status === 410;
  }
}

/**
 * The website blocks PeatedBot, and this request can't go through Firecrawl:
 * it is not a plain GET, or Firecrawl is not configured or will not read it.
 */
export class ScraperBlockedError extends Error {
  override name = "ScraperBlockedError";

  constructor(readonly origin: string) {
    super("The website blocks PeatedBot and this request has no other route.");
  }
}

export type ScraperRequestErrorCategory =
  | "invalid_request"
  | "redirect_limit"
  | "response_too_large"
  | "timeout"
  | "transport";

export class ScraperRequestError extends Error {
  override name = "ScraperRequestError";

  constructor(readonly category: ScraperRequestErrorCategory) {
    super(`Scraper request failed: ${category}.`);
  }
}

export type ScraperHttpClock = {
  now(): Date;
  sleep(milliseconds: number): Promise<void>;
  random(): number;
};

export const scraperSystemClock: ScraperHttpClock = {
  now: () => new Date(),
  sleep: async (milliseconds) => {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  },
  random: Math.random,
};

export type ScraperBot = Pick<PeatedBot, "request" | "isAllowedByRobots">;

/**
 * Scrapers' PeatedBot. A `fetchImpl` override, used by tests and local
 * previews, gets an in-memory cache so its robots.txt rules never reach the
 * shared Redis cache.
 */
export function createScraperBot({
  fetchImpl,
  clock = scraperSystemClock,
}: {
  fetchImpl?: typeof fetch;
  clock?: ScraperHttpClock;
} = {}): ScraperBot {
  return createServerPeatedBot({
    firecrawlApiKey:
      config.SCRAPER_FIRECRAWL_API_KEY ?? config.FIRECRAWL_API_KEY,
    fetch: fetchImpl,
    cache: fetchImpl ? createMemoryCache(() => clock.now()) : undefined,
    now: () => clock.now(),
  });
}

interface ScraperRequestHeaders {
  [name: string]: string;
}

function safeRequestHeaders(
  input: Readonly<Record<string, string>> | undefined,
  allowedRequestHeaders: readonly string[],
) {
  // PeatedBot adds its own User-Agent and signature.
  const headers: ScraperRequestHeaders = {
    Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
  };
  for (const [name, value] of Object.entries(input ?? {})) {
    if (
      !SAFE_REQUEST_HEADERS.has(name.toLowerCase()) &&
      !allowedRequestHeaders.includes(name.toLowerCase())
    ) {
      throw new ScraperRequestError("invalid_request");
    }
    headers[name] = value;
  }
  return headers;
}

function exposedResponseHeaders(headers: Headers) {
  const result: Record<string, string> = {};
  headers.forEach((value, name) => {
    if (EXPOSED_RESPONSE_HEADERS.has(name.toLowerCase())) result[name] = value;
  });
  return result;
}

async function discardResponse(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best effort after the runtime has decided not to retain a body.
  }
}

async function readResponseBody(response: Response, maximumBytes: number) {
  const length = response.headers.get("content-length");
  if (length !== null) {
    const parsed = Number(length);
    if (Number.isFinite(parsed) && parsed > maximumBytes) {
      await discardResponse(response);
      throw new ScraperRequestError("response_too_large");
    }
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new ScraperRequestError("response_too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ScraperRequestError) throw error;
    throw new ScraperRequestError("transport");
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function transientStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

function retryDelay(retry: number, random: number) {
  const base = RETRY_BASE_DELAY_MS * 2 ** (retry - 1);
  return Math.round(base + base * 0.25 * random);
}

export function parseRetryAfter(
  value: string | null,
  now = new Date(),
): Date | null {
  if (!value) return null;
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) {
    const seconds = Number(normalized);
    if (!Number.isSafeInteger(seconds)) return null;
    const retryAt = new Date(now.getTime() + seconds * 1_000);
    return Number.isNaN(retryAt.getTime()) ? null : retryAt;
  }
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp) || timestamp <= now.getTime()) return null;
  return new Date(timestamp);
}

function throwRobotsRefusal(
  reason: Extract<RobotsCheck, { allowed: false }>["reason"],
  url: URL,
  clock: ScraperHttpClock,
): never {
  switch (reason) {
    case "robots_disallowed":
      throw new ScraperRobotsDeniedError(url.origin);
    case "robots_unavailable":
      throw new ScraperRequestWaitError(
        "robots_unavailable",
        new Date(clock.now().getTime() + ROBOTS_UNAVAILABLE_RETRY_MS),
      );
    case "not_public":
    case "peated_website":
      throw new ScraperRequestError("invalid_request");
  }
}

async function acquireOrDefer({
  runId,
  executionToken,
  targetKey,
  isRetry,
  canResumeLater,
  clock,
}: {
  runId: number;
  executionToken: string;
  targetKey: string;
  isRetry: boolean;
  canResumeLater: boolean;
  clock: ScraperHttpClock;
}) {
  while (true) {
    const result = await acquireScrapePermit({
      runId,
      executionToken,
      targetKey,
      isRetry,
      now: clock.now(),
    });
    if (result.granted) return result;

    const delay = result.nextEligibleAt
      ? result.nextEligibleAt.getTime() - clock.now().getTime()
      : null;
    if (
      result.reason === "target_spacing" &&
      delay !== null &&
      !canResumeLater
    ) {
      if (delay > 0) await clock.sleep(delay);
      continue;
    }
    if (
      [
        "target_not_found",
        "run_not_found",
        "run_inactive",
        "target_not_allowed",
        "target_disabled",
      ].includes(result.reason)
    ) {
      throw new ScraperRequestError("invalid_request");
    }
    throw new ScraperRequestWaitError(result.reason, result.nextEligibleAt);
  }
}

export async function requestScraperUrl({
  runId,
  executionToken,
  sourceKey,
  request,
  registry,
  bot,
  clock = scraperSystemClock,
}: {
  runId: number;
  executionToken: string;
  sourceKey: string;
  request: ScraperRequest;
  registry: ScraperRegistry;
  bot: ScraperBot;
  clock?: ScraperHttpClock;
}): Promise<ScraperResponse> {
  let currentUrl = new URL(request.url);
  const initialOrigin = currentUrl.origin;
  const method = request.method ?? "GET";
  if (
    currentUrl.username ||
    currentUrl.password ||
    !["http:", "https:"].includes(currentUrl.protocol)
  ) {
    throw new ScraperRequestError("invalid_request");
  }
  if (
    (method === "GET" && request.body !== undefined) ||
    (request.body !== undefined &&
      new TextEncoder().encode(request.body).byteLength >
        MAX_REQUEST_BODY_BYTES)
  ) {
    throw new ScraperRequestError("invalid_request");
  }
  const target = registry.targets.get(request.target);
  if (!target) throw new ScraperRequestError("invalid_request");
  const headers = safeRequestHeaders(
    request.headers,
    target.allowedRequestHeaders,
  );
  const hasTargetSpecificHeaders = Object.keys(request.headers ?? {}).some(
    (name) => !SAFE_REQUEST_HEADERS.has(name.toLowerCase()),
  );

  // A bot wall marks the website blocked, so the request is sent once more,
  // through Firecrawl when it can be. A second wall means that did not help.
  let hitBotWall = false;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    resolveScraperOrigin(registry, sourceKey, request.target, currentUrl);
    if (hasNonPublicLiteralAddress(currentUrl)) {
      throw new ScraperRequestError("invalid_request");
    }
    if (
      currentUrl.origin !== initialOrigin &&
      (hasTargetSpecificHeaders || method !== "GET")
    ) {
      throw new ScraperRequestError("invalid_request");
    }
    const robots = await getScraperRobotsMode({
      registry,
      sourceKey,
      targetKey: request.target,
      url: currentUrl,
    });
    if (robots === "unsynced") {
      throw new ScraperRequestWaitError("robots_unavailable", null);
    }
    if (robots === "target_disabled") {
      throw new ScraperRequestError("invalid_request");
    }
    // Check robots.txt before taking a permit, so a refused page costs the
    // run nothing.
    if (robots === "follow") {
      const check = await bot.isAllowedByRobots(currentUrl);
      if (!check.allowed) throwRobotsRefusal(check.reason, currentUrl, clock);
    }
    let retry = 0;

    while (true) {
      let permit;
      try {
        permit = await acquireOrDefer({
          runId,
          executionToken,
          targetKey: request.target,
          isRetry: retry > 0,
          canResumeLater: request.canResumeLater ?? false,
          clock,
        });
      } catch (error) {
        if (error instanceof ScraperRequestWaitError && redirect > 0) {
          throw new ScraperRequestWaitError(
            error.reason,
            error.nextEligibleAt,
            currentUrl,
          );
        }
        throw error;
      }
      const release = async (resetRateLimitStreak?: boolean) => {
        await releaseScrapePermit({
          targetKey: request.target,
          token: permit.token,
          resetRateLimitStreak,
          now: clock.now(),
        });
      };
      let result: BotResponse;
      try {
        result = await bot.request({
          url: currentUrl,
          method,
          headers,
          body: request.body,
          timeoutMs: permit.timeoutMs,
          robots,
        });
      } catch (error) {
        await release();
        throw error;
      }

      if (result.status === "refused") {
        await release();
        if (result.reason === "blocked") {
          throw new ScraperBlockedError(currentUrl.origin);
        }
        if (result.reason === "invalid_url") {
          throw new ScraperRequestError("invalid_request");
        }
        throwRobotsRefusal(result.reason, currentUrl, clock);
      }

      if (result.status === "bot_wall") {
        await release();
        if (hitBotWall) throw new ScraperBlockedError(currentUrl.origin);
        hitBotWall = true;
        continue;
      }

      if (result.status === "failed") {
        await release();
        await recordScrapeRequestError({ runId, executionToken });
        if (result.route === "firecrawl") {
          await recordScrapeBypassRequest({ runId, executionToken });
        }
        const category = result.reason === "timeout" ? "timeout" : "transport";
        const canRetry =
          retry < permit.maxRetries &&
          (method === "GET" || request.retryable === true);
        if (canRetry && permit.remainingRequests <= 0) {
          throw new ScraperRequestWaitError("run_budget", null);
        }
        if (canRetry) {
          retry += 1;
          await clock.sleep(retryDelay(retry, clock.random()));
          continue;
        }
        throw new ScraperRequestError(category);
      }

      if (result.route === "firecrawl") {
        try {
          await recordScrapeBypassRequest({ runId, executionToken });
          // Firecrawl follows redirects itself, so the page it ended on must
          // belong to this target too.
          if (result.url.href !== currentUrl.href) {
            resolveScraperOrigin(
              registry,
              sourceKey,
              request.target,
              result.url,
            );
          }
        } catch (error) {
          await discardResponse(result.response);
          await release();
          throw error;
        }
        currentUrl = result.url;
      }
      const response = result.response;

      const retryAfter = parseRetryAfter(
        response.headers.get("retry-after"),
        clock.now(),
      );
      if (response.status === 429 || (response.status === 503 && retryAfter)) {
        await discardResponse(response);
        const nextEligibleAt = await recordScrapeRateLimit({
          runId,
          targetKey: request.target,
          token: permit.token,
          retryAt: retryAfter,
          now: clock.now(),
        });
        throw new ScraperRequestWaitError(
          "rate_limited",
          nextEligibleAt,
          redirect > 0 ? currentUrl : null,
        );
      }

      if (
        transientStatus(response.status) &&
        retry < permit.maxRetries &&
        (method === "GET" || request.retryable === true)
      ) {
        await discardResponse(response);
        await releaseScrapePermit({
          targetKey: request.target,
          token: permit.token,
          now: clock.now(),
        });
        await recordScrapeRequestError({ runId, executionToken });
        if (permit.remainingRequests <= 0) {
          throw new ScraperRequestWaitError("run_budget", null);
        }
        retry += 1;
        await clock.sleep(retryDelay(retry, clock.random()));
        continue;
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await discardResponse(response);
        await releaseScrapePermit({
          targetKey: request.target,
          token: permit.token,
          resetRateLimitStreak: true,
          now: clock.now(),
        });
        if (!location) {
          await recordScrapeRequestError({ runId, executionToken });
          throw new ScraperHttpStatusError(
            response.status,
            currentUrl,
            exposedResponseHeaders(response.headers),
          );
        }
        currentUrl = new URL(location, currentUrl);
        break;
      }

      if (response.status >= 400) {
        await discardResponse(response);
        await releaseScrapePermit({
          targetKey: request.target,
          token: permit.token,
          resetRateLimitStreak: response.status < 500,
          now: clock.now(),
        });
        await recordScrapeRequestError({ runId, executionToken });
        throw new ScraperHttpStatusError(
          response.status,
          currentUrl,
          exposedResponseHeaders(response.headers),
        );
      }

      try {
        const body = await readResponseBody(response, permit.maxResponseBytes);
        await releaseScrapePermit({
          targetKey: request.target,
          token: permit.token,
          resetRateLimitStreak: true,
          now: clock.now(),
        });
        return {
          url: currentUrl,
          status: response.status,
          headers: exposedResponseHeaders(response.headers),
          body,
        };
      } catch (error) {
        await releaseScrapePermit({
          targetKey: request.target,
          token: permit.token,
          now: clock.now(),
        });
        await recordScrapeRequestError({ runId, executionToken });
        throw error;
      }
    }
  }

  throw new ScraperRequestError("redirect_limit");
}
