import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const identityProviderEnum = pgEnum("identity_provider", ["google"]);

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
  (identities) => {
    return {
      emailIndex: uniqueIndex("identity_unq").on(
        identities.provider,
        identities.externalId,
      ),
    };
  },
);

export const identitiesRelations = relations(identities, ({ one }) => ({
  user: one(users, {
    fields: [identities.userId],
    references: [users.id],
  }),
}));
