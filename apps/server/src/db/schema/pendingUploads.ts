import { relations } from "drizzle-orm";
import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const PENDING_UPLOAD_KIND_LIST = ["image"] as const;
export const PENDING_UPLOAD_PURPOSE_LIST = [
  "photo_tasting_entry",
  "tasting_image",
  "bottle_image",
  "bottle_release_image",
  "badge_image",
  "avatar",
] as const;
export const PENDING_UPLOAD_STATUS_LIST = [
  "pending",
  "attached",
  "expired",
] as const;

export const pendingUploadKindEnum = pgEnum(
  "pendingUploadKind",
  PENDING_UPLOAD_KIND_LIST,
);
export const pendingUploadPurposeEnum = pgEnum(
  "pendingUploadPurpose",
  PENDING_UPLOAD_PURPOSE_LIST,
);
export const pendingUploadStatusEnum = pgEnum(
  "pendingUploadStatus",
  PENDING_UPLOAD_STATUS_LIST,
);

export const pendingUploads = pgTable(
  "pending_upload",
  {
    id: text("id").primaryKey(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    imageUrl: text("image_url").notNull(),
    namespace: varchar("namespace", { length: 64 }).notNull(),
    kind: pendingUploadKindEnum("kind").notNull(),
    purpose: pendingUploadPurposeEnum("purpose").notNull(),
    status: pendingUploadStatusEnum("status").default("pending").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    attachedToType: varchar("attached_to_type", { length: 64 }),
    attachedToId: bigint("attached_to_id", { mode: "number" }),
    objectDeletedAt: timestamp("object_deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    unique("pending_upload_idempotency_key").on(
      table.createdById,
      table.purpose,
      table.idempotencyKey,
    ),
    index("pending_upload_created_by_idx").on(table.createdById),
    index("pending_upload_status_expires_at_idx").on(
      table.status,
      table.expiresAt,
    ),
  ],
);

export const pendingUploadsRelations = relations(pendingUploads, ({ one }) => ({
  createdBy: one(users, {
    fields: [pendingUploads.createdById],
    references: [users.id],
  }),
}));

export type PendingUpload = typeof pendingUploads.$inferSelect;
export type NewPendingUpload = typeof pendingUploads.$inferInsert;
