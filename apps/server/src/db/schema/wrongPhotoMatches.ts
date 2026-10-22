import type { ImageBottleEvidence } from "@peated/bottle-classifier/contract";
import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { bottles } from "./bottles";
import { users } from "./users";

// A member said the Bottle matched from their label photo was not theirs.
// Admins read these to build classifier checks. Each keeps the label facts the
// model read and, for 30 days, a copy of the photo that is not shown publicly;
// see docs/features/photo-assisted-bottle-resolution.md for access and retention.
export const wrongPhotoMatches = pgTable(
  "wrong_photo_match",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    // One per photo, so a repeated tap returns the same row.
    pendingUploadId: text("pending_upload_id").notNull(),
    // Null once the photo copy is deleted after WRONG_PHOTO_MATCH_PHOTO_TTL_MS.
    imageUrl: text("image_url"),
    imageEvidence: jsonb("image_evidence")
      .$type<ImageBottleEvidence>()
      .notNull(),
    // Kept after an admin retires a Bottle; merges move it to the survivor.
    wrongBottleId: bigint("wrong_bottle_id", { mode: "number" }).references(
      () => bottles.id,
      { onDelete: "set null" },
    ),
    // The Bottle the member chose next, if any.
    correctBottleId: bigint("correct_bottle_id", { mode: "number" }).references(
      () => bottles.id,
      { onDelete: "set null" },
    ),
    traceId: varchar("trace_id", { length: 32 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wrong_photo_match_pending_upload_unq").on(
      table.createdById,
      table.pendingUploadId,
    ),
    index("wrong_photo_match_created_at_idx").on(table.createdAt),
    index("wrong_photo_match_wrong_bottle_idx").on(table.wrongBottleId),
    index("wrong_photo_match_correct_bottle_idx").on(table.correctBottleId),
  ],
);

export const wrongPhotoMatchesRelations = relations(
  wrongPhotoMatches,
  ({ one }) => ({
    createdBy: one(users, {
      fields: [wrongPhotoMatches.createdById],
      references: [users.id],
    }),
    wrongBottle: one(bottles, {
      fields: [wrongPhotoMatches.wrongBottleId],
      references: [bottles.id],
      relationName: "wrongPhotoMatchWrongBottle",
    }),
    correctBottle: one(bottles, {
      fields: [wrongPhotoMatches.correctBottleId],
      references: [bottles.id],
      relationName: "wrongPhotoMatchCorrectBottle",
    }),
  }),
);

export type WrongPhotoMatch = typeof wrongPhotoMatches.$inferSelect;
export type NewWrongPhotoMatch = typeof wrongPhotoMatches.$inferInsert;
