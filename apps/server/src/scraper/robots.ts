import { BOT_USER_AGENT } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  type CachedRobotsRules,
  scrapeOrigins,
} from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { resolveScraperOrigin } from "./definitions";
import {
  requestScraperUrl,
  type ScraperHttpClock,
  ScraperHttpStatusError,
  ScraperRequestDeferredError,
} from "./http";
import type { ScraperRegistry } from "./types";

const ROBOTS_CACHE_MS = 24 * 60 * 60_000;
const ROBOTS_UNAVAILABLE_RETRY_MS = 15 * 60_000;

const RobotsRuleSchema = z
  .object({
    directive: z.enum(["allow", "disallow"]),
    path: z.string(),
  })
  .strict();
const CachedRobotsRulesSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("missing") }).strict(),
  z
    .object({
      status: z.literal("rules"),
      groups: z.array(
        z
          .object({
            userAgents: z.array(z.string()),
            rules: z.array(RobotsRuleSchema),
          })
          .strict(),
      ),
    })
    .strict(),
]);

export class ScraperRobotsDeniedError extends Error {
  override name = "ScraperRobotsDeniedError";

  constructor(readonly origin: string) {
    super("Robots policy disallows this scraper path.");
  }
}

export function parseRobotsRules(body: string): CachedRobotsRules {
  const groups: Extract<CachedRobotsRules, { status: "rules" }>["groups"] = [];
  let current: (typeof groups)[number] | null = null;

  for (const originalLine of body.split(/\r?\n/)) {
    const line = originalLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!value) continue;
      if (!current || current.rules.length > 0) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
      }
      current.userAgents.push(value.toLowerCase());
      continue;
    }
    if (current && (field === "allow" || field === "disallow") && value) {
      current.rules.push({ directive: field, path: value });
    }
  }

  return { status: "rules", groups };
}

function matchingUserAgentGroups(
  state: Extract<CachedRobotsRules, { status: "rules" }>,
) {
  const product =
    BOT_USER_AGENT.split(/[\s/]/, 1)[0]?.toLowerCase() ?? "peatedbot";
  let specificity = -1;
  const result: typeof state.groups = [];
  for (const group of state.groups) {
    const matchingAgents = group.userAgents.filter(
      (agent) => agent === "*" || product.startsWith(agent),
    );
    if (matchingAgents.length === 0) continue;
    const groupSpecificity = Math.max(
      ...matchingAgents.map((agent) => (agent === "*" ? 0 : agent.length)),
    );
    if (groupSpecificity > specificity) {
      specificity = groupSpecificity;
      result.length = 0;
    }
    if (groupSpecificity === specificity) result.push(group);
  }
  return result;
}

function robotsPatternMatches(path: string, pattern: string) {
  const endAnchored = pattern.endsWith("$");
  const withoutAnchor = endAnchored ? pattern.slice(0, -1) : pattern;
  const expression = withoutAnchor
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${expression}${endAnchored ? "$" : ""}`).test(path);
}

export function robotsAllowsUrl(state: CachedRobotsRules, url: URL) {
  if (state.status === "missing") return true;
  const path = `${url.pathname}${url.search}`;
  const matches = matchingUserAgentGroups(state)
    .flatMap((group) => group.rules)
    .filter((rule) => robotsPatternMatches(path, rule.path))
    .map((rule) => ({
      ...rule,
      specificity: rule.path.replace(/[*$]/g, "").length,
    }))
    .sort((left, right) => {
      if (left.specificity !== right.specificity) {
        return right.specificity - left.specificity;
      }
      return left.directive === "allow" ? -1 : 1;
    });
  return matches[0]?.directive !== "disallow";
}

async function writeRobotsCache(
  origin: string,
  state: CachedRobotsRules,
  now: Date,
) {
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
  registry,
  fetchImpl = fetch,
  clock,
}: {
  runId: number;
  executionToken: string;
  sourceKey: string;
  targetKey: string;
  url: URL;
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
    throw new ScraperRequestDeferredError("robots_unavailable", null);
  }

  const now = clock.now();
  let state = CachedRobotsRulesSchema.safeParse(origin.robotsState);
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
        },
        registry,
        fetchImpl,
        clock,
      });
      const parsed = parseRobotsRules(response.body);
      await writeRobotsCache(url.origin, parsed, now);
      state = CachedRobotsRulesSchema.safeParse(parsed);
    } catch (error) {
      if (error instanceof ScraperHttpStatusError && error.status === 404) {
        const missing = { status: "missing" } as const;
        await writeRobotsCache(url.origin, missing, now);
        state = CachedRobotsRulesSchema.safeParse(missing);
      } else if (error instanceof ScraperRequestDeferredError) {
        throw error;
      } else {
        throw new ScraperRequestDeferredError(
          "robots_unavailable",
          new Date(now.getTime() + ROBOTS_UNAVAILABLE_RETRY_MS),
        );
      }
    }
  }

  if (!state.success) {
    throw new ScraperRequestDeferredError(
      "robots_unavailable",
      new Date(now.getTime() + ROBOTS_UNAVAILABLE_RETRY_MS),
    );
  }
  if (!robotsAllowsUrl(state.data, url)) {
    throw new ScraperRobotsDeniedError(url.origin);
  }
}
