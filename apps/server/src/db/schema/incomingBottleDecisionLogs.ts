import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { actors } from "./actors";
import { bottleReleases, bottles } from "./bottles";
import { externalSites } from "./externalSites";
import { storePriceMatchProposals } from "./stores";

export const incomingBottleDecisionSourceKindEnum = pgEnum(
  "incoming_bottle_decision_source_kind",
  ["review", "store_price"],
);
export const incomingBottleDecisionTypeEnum = pgEnum(
  "incoming_bottle_decision_type",
  [
    "match_existing",
    "create_bottle",
    "create_release",
    "create_bottle_and_release",
  ],
);
export const incomingBottleDecisionLogs = pgTable(
  "incoming_bottle_decision_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceKind: incomingBottleDecisionSourceKindEnum("source_kind").notNull(),
    sourceId: bigint("source_id", { mode: "number" }).notNull(),
    proposalId: bigint("proposal_id", { mode: "number" }).references(
      () => storePriceMatchProposals.id,
      { onDelete: "set null" },
    ),
    externalSiteId: bigint("external_site_id", { mode: "number" })
      .references(() => externalSites.id)
      .notNull(),
    name: text("name").notNull(),
    url: text("url"),
    decision: incomingBottleDecisionTypeEnum("decision").notNull(),
    actorId: bigint("actor_id", { mode: "number" })
      .references(() => actors.id)
      .notNull(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    releaseId: bigint("release_id", { mode: "number" }).references(
      () => bottleReleases.id,
    ),
    createdBottle: boolean("created_bottle").default(false).notNull(),
    createdRelease: boolean("created_release").default(false).notNull(),
    confidence: integer("confidence"),
    model: text("model"),
    rationale: text("rationale"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("incoming_bottle_decision_source_unq").on(
      table.sourceKind,
      table.sourceId,
    ),
    index("incoming_bottle_decision_created_idx").on(table.createdAt),
    index("incoming_bottle_decision_external_site_idx").on(
      table.externalSiteId,
    ),
    index("incoming_bottle_decision_bottle_idx").on(table.bottleId),
    index("incoming_bottle_decision_release_idx").on(table.releaseId),
    index("incoming_bottle_decision_actor_ref_idx").on(table.actorId),
  ],
);

export const incomingBottleDecisionLogsRelations = relations(
  incomingBottleDecisionLogs,
  ({ one }) => ({
    externalSite: one(externalSites, {
      fields: [incomingBottleDecisionLogs.externalSiteId],
      references: [externalSites.id],
    }),
    proposal: one(storePriceMatchProposals, {
      fields: [incomingBottleDecisionLogs.proposalId],
      references: [storePriceMatchProposals.id],
    }),
    actor: one(actors, {
      fields: [incomingBottleDecisionLogs.actorId],
      references: [actors.id],
    }),
    bottle: one(bottles, {
      fields: [incomingBottleDecisionLogs.bottleId],
      references: [bottles.id],
    }),
    release: one(bottleReleases, {
      fields: [incomingBottleDecisionLogs.releaseId],
      references: [bottleReleases.id],
    }),
  }),
);

export type IncomingBottleDecisionLog =
  typeof incomingBottleDecisionLogs.$inferSelect;
export type NewIncomingBottleDecisionLog =
  typeof incomingBottleDecisionLogs.$inferInsert;
