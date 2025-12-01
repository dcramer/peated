import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const identityProviderEnum = pgEnum("identity_provider", [
  "google",
  "passkey",
]);

export const identities = pgTable(
  "identity",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: identityProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(),
    userId: bigint("user_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (table) => [
    uniqueIndex("identity_unq").on(table.provider, table.externalId),
    index("identity_user_idx").on(table.userId),
  ],
);

export const identitiesRelations = relations(identities, ({ one }) => ({
  user: one(users, {
    fields: [identities.userId],
    references: [users.id],
  }),
}));
