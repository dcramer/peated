import {
  bigint,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const loginRequests = pgTable(
  "login_request",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    requestId: text("request_id").notNull(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [uniqueIndex("login_request_request_id_unq").on(table.requestId)],
);

export type LoginRequest = typeof loginRequests.$inferSelect;
export type NewLoginRequest = typeof loginRequests.$inferInsert;
