import { sql } from "drizzle-orm";
import { bigint, check, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * PeatedBot's long-term settings for one website, keyed by origin. A website
 * without a row uses the defaults: robots.txt applies and reads go direct.
 * Rules: `docs/policies/blocked-websites.md`.
 */
export const botSites = pgTable(
  "bot_site",
  {
    origin: text("origin").primaryKey(),
    /** Why an admin let PeatedBot skip this website's robots.txt. */
    robotsExceptionReason: text("robots_exception_reason"),
    robotsExceptionById: bigint("robots_exception_by_id", {
      mode: "number",
    }).references(() => users.id),
    robotsExceptionAt: timestamp("robots_exception_at"),
    /** When a direct read first hit a bot wall. Cleared by an admin. */
    blockedAt: timestamp("blocked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("bot_site_origin_check", sql`${table.origin} ~ '^https?://[^/]+$'`),
    // Blocked websites policy: an exception always records its reason, who
    // made it, and when.
    check(
      "bot_site_robots_exception_check",
      sql`(${table.robotsExceptionReason} IS NULL
          AND ${table.robotsExceptionById} IS NULL
          AND ${table.robotsExceptionAt} IS NULL)
        OR (${table.robotsExceptionReason} IS NOT NULL
          AND ${table.robotsExceptionById} IS NOT NULL
          AND ${table.robotsExceptionAt} IS NOT NULL)`,
    ),
  ],
);

export type BotSite = typeof botSites.$inferSelect;
