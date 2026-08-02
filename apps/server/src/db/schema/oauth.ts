import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const oauthClients = pgTable(
  "oauth_client",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    redirectUris: text("redirect_uris").array().notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("oauth_client_client_id_unq").on(table.clientId)],
);

export const oauthAuthorizationCodes = pgTable(
  "oauth_authorization_code",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    codeDigest: varchar("code_digest", { length: 64 }).notNull(),
    oauthClientId: bigint("oauth_client_id", { mode: "number" })
      .references(() => oauthClients.id, { onDelete: "cascade" })
      .notNull(),
    userId: bigint("user_id", { mode: "number" })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: varchar("code_challenge", { length: 128 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
  },
  (table) => [
    uniqueIndex("oauth_authorization_code_digest_unq").on(table.codeDigest),
    index("oauth_authorization_code_client_idx").on(table.oauthClientId),
    index("oauth_authorization_code_user_idx").on(table.userId),
    index("oauth_authorization_code_expires_idx").on(table.expiresAt),
  ],
);

export const oauthClientsRelations = relations(oauthClients, ({ many }) => ({
  authorizationCodes: many(oauthAuthorizationCodes),
}));

export const oauthAuthorizationCodesRelations = relations(
  oauthAuthorizationCodes,
  ({ one }) => ({
    client: one(oauthClients, {
      fields: [oauthAuthorizationCodes.oauthClientId],
      references: [oauthClients.id],
    }),
    user: one(users, {
      fields: [oauthAuthorizationCodes.userId],
      references: [users.id],
    }),
  }),
);

export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;
export type OAuthAuthorizationCode =
  typeof oauthAuthorizationCodes.$inferSelect;
export type NewOAuthAuthorizationCode =
  typeof oauthAuthorizationCodes.$inferInsert;
