import { BOT_USER_AGENT } from "@peated/server/constants";
import {
  acquireScrapePermit,
  type PermitDenialReason,
  recordScrapeRateLimit,
  releaseScrapePermit,
} from "./coordinator";
import { resolveScraperOrigin } from "./definitions";
import type { ScraperRegistry, ScraperRequest, ScraperResponse } from "./types";

const MAX_REDIRECTS = 5;
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

export type ScraperDeferralReason =
  | PermitDenialReason
  | "rate_limited"
  | "robots_unavailable";

export class ScraperRequestDeferredError extends Error {
  override name = "ScraperRequestDeferredError";

  constructor(
    readonly reason: ScraperDeferralReason,
    readonly nextEligibleAt: Date | null,
  ) {
    super(`Scraper request deferred: ${reason}.`);
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

function safeRequestHeaders(
  input: Readonly<Record<string, string>> | undefined,
  allowedRequestHeaders: readonly string[],
) {
  const headers: Record<string, string> = {
    Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    "User-Agent": BOT_USER_AGENT,
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

function transportCategory(error: unknown): ScraperRequestErrorCategory {
  if (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return "timeout";
  }
  return "transport";
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

async function acquireOrDefer({
  runId,
  executionToken,
  targetKey,
  isRetry,
  clock,
}: {
  runId: number;
  executionToken: string;
  targetKey: string;
  isRetry: boolean;
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
    if (result.reason === "target_spacing" && delay !== null) {
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
    throw new ScraperRequestDeferredError(result.reason, result.nextEligibleAt);
  }
}

export async function requestScraperUrl({
  runId,
  executionToken,
  sourceKey,
  request,
  registry,
  fetchImpl = fetch,
  clock = scraperSystemClock,
}: {
  runId: number;
  executionToken: string;
  sourceKey: string;
  request: ScraperRequest;
  registry: ScraperRegistry;
  fetchImpl?: typeof fetch;
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

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    resolveScraperOrigin(registry, sourceKey, request.target, currentUrl);
    if (
      currentUrl.origin !== initialOrigin &&
      (hasTargetSpecificHeaders || method !== "GET")
    ) {
      throw new ScraperRequestError("invalid_request");
    }
    let retry = 0;

    while (true) {
      const permit = await acquireOrDefer({
        runId,
        executionToken,
        targetKey: request.target,
        isRetry: retry > 0,
        clock,
      });
      let response: Response;
      try {
        response = await fetchImpl(currentUrl, {
          method,
          body: request.body,
          headers,
          redirect: "manual",
          signal: AbortSignal.timeout(permit.timeoutMs),
        });
      } catch (error) {
        await releaseScrapePermit({
          targetKey: request.target,
          token: permit.token,
          now: clock.now(),
        });
        const canRetry =
          retry < permit.maxRetries &&
          (method === "GET" || request.retryable === true);
        if (canRetry && permit.remainingRequests <= 0) {
          throw new ScraperRequestDeferredError("run_budget", null);
        }
        if (canRetry) {
          retry += 1;
          await clock.sleep(retryDelay(retry, clock.random()));
          continue;
        }
        throw new ScraperRequestError(transportCategory(error));
      }

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
        throw new ScraperRequestDeferredError("rate_limited", nextEligibleAt);
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
        if (permit.remainingRequests <= 0) {
          throw new ScraperRequestDeferredError("run_budget", null);
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
        throw error;
      }
    }
  }

  throw new ScraperRequestError("redirect_limit");
}
