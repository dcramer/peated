import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  pgTable,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { tastings } from "./tastings";
import { users } from "./users";

export const toasts = pgTable(
  // oops named this wrong sorry
  "toasts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tastingId: bigint("tasting_id", { mode: "number" })
      .references(() => tastings.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (toasts) => {
    return {
      toastId: uniqueIndex("toast_unq").on(
        toasts.tastingId,
        toasts.createdById,
      ),
    };
  },
);

export const toastsRelations = relations(toasts, ({ one }) => ({
  tasting: one(tastings, {
    fields: [toasts.tastingId],
    references: [tastings.id],
  }),
  createdBy: one(users, {
    fields: [toasts.createdById],
    references: [users.id],
  }),
}));

export type Toast = typeof toasts.$inferSelect;
export type NewToast = typeof toasts.$inferInsert;
