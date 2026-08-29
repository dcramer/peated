import { db } from "@peated/server/db";
import {
  type ScrapeOrigin,
  type ScrapeTarget,
  scrapeOrigins,
} from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import type { ScrapeOriginDefinition, ScrapeTargetDefinition } from "../types";

function toOrigin(origin: ScrapeOrigin): ScrapeOriginDefinition {
  return {
    origin: origin.origin,
    robots:
      origin.robotsMode === "enforce"
        ? { mode: "enforce" }
        : {
            mode: "not_applicable",
            rationale: origin.robotsRationale ?? "Approved access exception.",
          },
  };
}

export async function loadScrapeSourceTarget(
  target: ScrapeTarget,
): Promise<ScrapeTargetDefinition> {
  const origins = await db
    .select()
    .from(scrapeOrigins)
    .where(
      and(
        eq(scrapeOrigins.targetKey, target.key),
        eq(scrapeOrigins.active, true),
      ),
    );
  const [firstOrigin, ...otherOrigins] = origins;
  if (!firstOrigin) {
    throw new Error("This source has no active web address.");
  }

  return {
    key: target.key,
    enabled: target.enabled,
    minimumSpacingMs: target.minimumSpacingMs,
    requestsPerWindow: target.requestsPerWindow,
    windowMs: target.windowMs,
    timeoutMs: target.timeoutMs,
    maxResponseBytes: target.maxResponseBytes,
    maxRetries: target.maxRetries,
    allowedRequestHeaders: [],
    origins: [toOrigin(firstOrigin), ...otherOrigins.map(toOrigin)],
  };
}
