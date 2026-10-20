import type { StoredTastingDraftIdentification } from "@peated/server/schemas/tastingDrafts";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { bottles } from "./bottles";
import { ratingBandEnum, servingStyleEnum } from "./tastings";
import { users } from "./users";

export const TASTING_DRAFT_BOTTLE_HINT_MAX_LENGTH = 255;

export const TASTING_DRAFT_IDENTIFICATION_STATUS_LIST = [
  "none",
  "pending",
  "done",
  "failed",
] as const;

export const tastingDraftIdentificationStatusEnum = pgEnum(
  "tasting_draft_identification_status",
  TASTING_DRAFT_IDENTIFICATION_STATUS_LIST,
);

/**
 * A tasting a member has started but not posted. Drafts are private to their
 * owner and live apart from `tasting`, so feeds, stats, and badges never see
 * them. See docs/features/tasting-drafts.md.
 */
export const tastingDrafts = pgTable(
  "tasting_draft",
  {
    // Chosen by the client so an offline device can save before it has
    // talked to the server. Publishing uses it as the tasting's
    // idempotency key.
    id: uuid("id").primaryKey(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tastedAt: timestamp("tasted_at").notNull(),
    // What the member typed about the bottle before choosing one. It is
    // dropped when the draft is published.
    bottleHint: varchar("bottle_hint", {
      length: TASTING_DRAFT_BOTTLE_HINT_MAX_LENGTH,
    }),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
      { onDelete: "set null" },
    ),
    imageUrl: text("image_url"),
    // Identifying the Bottle from the photo runs in the background. `none`
    // means there is no photo. A new photo resets both fields. See
    // docs/features/tasting-drafts.md.
    identificationStatus: tastingDraftIdentificationStatusEnum(
      "identification_status",
    )
      .default("none")
      .notNull(),
    // Checked by StoredTastingDraftIdentificationSchema on every read.
    identification:
      jsonb("identification").$type<StoredTastingDraftIdentification>(),
    ratingBand: ratingBandEnum("rating_band"),
    notes: text("notes"),
    tags: varchar("tags", { length: 64 })
      .array()
      .default(sql`array[]::varchar[]`)
      .notNull(),
    servingStyle: servingStyleEnum("serving_style"),
    color: integer("color"),
    friends: bigint("friends", { mode: "number" })
      .array()
      .default(sql`array[]::bigint[]`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tasting_draft_created_by_updated_idx").on(
      table.createdById,
      table.updatedAt,
    ),
  ],
);

export const tastingDraftsRelations = relations(tastingDrafts, ({ one }) => ({
  bottle: one(bottles, {
    fields: [tastingDrafts.bottleId],
    references: [bottles.id],
  }),
  createdBy: one(users, {
    fields: [tastingDrafts.createdById],
    references: [users.id],
  }),
}));

export type TastingDraft = typeof tastingDrafts.$inferSelect;
export type NewTastingDraft = typeof tastingDrafts.$inferInsert;
