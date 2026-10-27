import {
  parseRobotsRules,
  ROBOTS_CACHE_MS,
  robotsAllowsUrl,
  type RobotsRules,
  RobotsRulesSchema,
} from "@peated/bot";
import { db } from "@peated/server/db";
import { scrapeOrigins } from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import { resolveScraperOrigin } from "./definitions";
import {
  requestScraperUrl,
  type ScraperHttpClock,
  ScraperHttpStatusError,
  ScraperRequestError,
  ScraperRequestWaitError,
} from "./http";
import type { ScraperRegistry } from "./types";

const ROBOTS_UNAVAILABLE_RETRY_MS = 15 * 60_000;

export class ScraperRobotsDeniedError extends Error {
  override name = "ScraperRobotsDeniedError";

  constructor(readonly origin: string) {
    super("Robots policy disallows this scraper path.");
  }
}

async function writeRobotsCache(origin: string, state: RobotsRules, now: Date) {
  await db
    .update(scrapeOrigins)
    .set({
      robotsState: state,
      robotsFetchedAt: now,
      robotsExpiresAt: new Date(now.getTime() + ROBOTS_CACHE_MS),
      updatedAt: now,
    })
    .where(
      and(eq(scrapeOrigins.origin, origin), eq(scrapeOrigins.active, true)),
    );
}

export async function ensureRobotsAllowed({
  runId,
  executionToken,
  sourceKey,
  targetKey,
  url,
  canResumeLater,
  registry,
  fetchImpl,
  clock,
}: {
  runId: number;
  executionToken: string;
  sourceKey: string;
  targetKey: string;
  url: URL;
  canResumeLater?: boolean;
  registry: ScraperRegistry;
  fetchImpl?: typeof fetch;
  clock: ScraperHttpClock;
}) {
  const definition = resolveScraperOrigin(registry, sourceKey, targetKey, url);
  if (definition.robots.mode === "not_applicable") return;

  const [origin] = await db
    .select()
    .from(scrapeOrigins)
    .where(
      and(
        eq(scrapeOrigins.origin, url.origin),
        eq(scrapeOrigins.targetKey, targetKey),
        eq(scrapeOrigins.active, true),
      ),
    );
  if (!origin || origin.robotsMode !== "enforce") {
    throw new ScraperRequestWaitError("robots_unavailable", null);
  }

  const now = clock.now();
  let state = RobotsRulesSchema.safeParse(origin.robotsState);
  if (
    !state.success ||
    !origin.robotsExpiresAt ||
    origin.robotsExpiresAt <= now
  ) {
    try {
      const response = await requestScraperUrl({
        runId,
        executionToken,
        sourceKey,
        request: {
          target: targetKey,
          url: new URL("/robots.txt", url.origin),
          headers: { Accept: "text/plain,*/*;q=0.1" },
          canResumeLater,
        },
        registry,
        fetchImpl,
        clock,
      });
      const parsed = parseRobotsRules(response.body);
      await writeRobotsCache(url.origin, parsed, now);
      state = RobotsRulesSchema.safeParse(parsed);
    } catch (error) {
      // Robots rule (RFC 9309 section 2.3.1.3): a 4xx robots.txt answer means
      // the site publishes no rules, so the crawl may proceed. A 5xx answer or a
      // network failure means the rules are unavailable, so the run waits.
      if (
        error instanceof ScraperHttpStatusError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        const missing = { status: "missing" } as const;
        await writeRobotsCache(url.origin, missing, now);
        state = RobotsRulesSchema.safeParse(missing);
      } else if (
        error instanceof ScraperHttpStatusError ||
        (error instanceof ScraperRequestError &&
          (error.category === "timeout" || error.category === "transport"))
      ) {
        throw new ScraperRequestWaitError(
          "robots_unavailable",
          new Date(now.getTime() + ROBOTS_UNAVAILABLE_RETRY_MS),
        );
      } else {
        throw error;
      }
    }
  }

  if (!state.success) {
    throw new ScraperRequestWaitError(
      "robots_unavailable",
      new Date(now.getTime() + ROBOTS_UNAVAILABLE_RETRY_MS),
    );
  }
  if (!robotsAllowsUrl(state.data, url)) {
    throw new ScraperRobotsDeniedError(url.origin);
  }
}
