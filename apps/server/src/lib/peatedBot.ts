import {
  type BotCache,
  type BotSiteSettings,
  createPeatedBot,
} from "@peated/bot";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { botSites } from "@peated/server/db/schema";
import { getConnection } from "@peated/server/worker/redis";
import { eq, sql } from "drizzle-orm";
import type IORedis from "ioredis";

const CACHE_TIMEOUT_MS = 250;

/**
 * PeatedBot's cache in Redis. It is best effort: when Redis errors or takes
 * longer than `timeoutMs`, a read is a miss and a write is skipped, so a Redis
 * outage costs extra robots.txt requests instead of stalling page reads. The
 * shared connection queues commands while Redis is down, so the timeout is
 * what keeps reads moving.
 */
export function createRedisBotCache({
  connect = getConnection,
  timeoutMs = CACHE_TIMEOUT_MS,
}: {
  connect?: () => Promise<Pick<IORedis, "get" | "set">>;
  timeoutMs?: number;
} = {}): BotCache {
  async function withTimeout<T>(
    command: (redis: Pick<IORedis, "get" | "set">) => Promise<T>,
  ): Promise<T | null> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    try {
      return await Promise.race([connect().then(command), timeout]);
    } catch {
      // Best effort by contract: a failed cache command acts like a miss.
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: async (key) => await withTimeout((redis) => redis.get(key)),
    set: async (key, value, ttlMs) => {
      await withTimeout((redis) => redis.set(key, value, "PX", ttlMs));
    },
  };
}

/** Reads a website's stored settings; a website without a row uses defaults. */
export async function getBotSiteSettings(
  origin: string,
): Promise<BotSiteSettings> {
  const [site] = await db
    .select({
      robotsExceptionReason: botSites.robotsExceptionReason,
      blockedAt: botSites.blockedAt,
    })
    .from(botSites)
    .where(eq(botSites.origin, origin));
  return {
    robotsException: site?.robotsExceptionReason != null,
    blocked: site?.blockedAt != null,
  };
}

/** Marks a website as blocked, keeping the first time it was blocked. */
export async function recordBotWall(origin: string) {
  const now = new Date();
  await db
    .insert(botSites)
    .values({ origin, blockedAt: now, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: botSites.origin,
      set: {
        blockedAt: sql`coalesce(${botSites.blockedAt}, excluded.blocked_at)`,
        updatedAt: now,
      },
    });
}

/**
 * The server's PeatedBot: Redis for the robots.txt cache and Postgres for
 * website settings. Callers choose the Firecrawl key for their workload.
 * Tests and local previews may replace the network, cache, and clock.
 */
export function createServerPeatedBot({
  firecrawlApiKey,
  fetch,
  cache = createRedisBotCache(),
  now,
}: {
  firecrawlApiKey: string | null;
  fetch?: typeof globalThis.fetch;
  cache?: BotCache;
  now?: () => Date;
}) {
  return createPeatedBot({
    cache,
    getSite: getBotSiteSettings,
    onBotWall: recordBotWall,
    firecrawl: firecrawlApiKey
      ? { apiKey: firecrawlApiKey, apiUrl: config.FIRECRAWL_API_URL }
      : null,
    privateJwk: config.PEATED_BOT_PRIVATE_JWK,
    fetch,
    now,
  });
}
