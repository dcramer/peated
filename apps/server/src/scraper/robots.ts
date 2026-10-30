import { db } from "@peated/server/db";
import { scrapeOrigins, scrapeTargets } from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import { resolveScraperOrigin } from "./definitions";
import type { ScraperRegistry } from "./types";

export class ScraperRobotsDeniedError extends Error {
  override name = "ScraperRobotsDeniedError";

  constructor(readonly origin: string) {
    super("Robots policy disallows this scraper path.");
  }
}

/**
 * How a scraper request treats robots.txt at `url`. PeatedBot reads and caches
 * the rules; this only decides whether they apply. An origin that follows
 * robots.txt must have a synced, active settings row, or this returns
 * `unsynced` and the request waits. A disabled target sends nothing, not even
 * a robots.txt request.
 */
export async function getScraperRobotsMode({
  registry,
  sourceKey,
  targetKey,
  url,
}: {
  registry: ScraperRegistry;
  sourceKey: string;
  targetKey: string;
  url: URL;
}): Promise<"follow" | "not_applicable" | "unsynced" | "target_disabled"> {
  const definition = resolveScraperOrigin(registry, sourceKey, targetKey, url);
  if (definition.robots.mode === "not_applicable") return "not_applicable";

  const [origin] = await db
    .select({
      robotsMode: scrapeOrigins.robotsMode,
      targetEnabled: scrapeTargets.enabled,
    })
    .from(scrapeOrigins)
    .innerJoin(scrapeTargets, eq(scrapeTargets.key, scrapeOrigins.targetKey))
    .where(
      and(
        eq(scrapeOrigins.origin, url.origin),
        eq(scrapeOrigins.targetKey, targetKey),
        eq(scrapeOrigins.active, true),
      ),
    );
  if (!origin || origin.robotsMode !== "enforce") return "unsynced";
  if (!origin.targetEnabled) return "target_disabled";
  return "follow";
}
