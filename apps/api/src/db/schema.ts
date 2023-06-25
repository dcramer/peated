import type { InferModel } from "drizzle-orm";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import {
  CATEGORY_LIST,
  SERVING_STYLE_LIST,
  STORE_TYPE_LIST,
} from "@peated/shared/constants";
import { geography } from "./columns";

export const users = pgTable(
  "user",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: varchar("password_hash", { length: 256 }),
    displayName: text("display_name"),
    pictureUrl: text("picture_url"),

    private: boolean("private").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    admin: boolean("admin").default(false).notNull(),
    mod: boolean("mod").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (users) => {
    return {
      emailIndex: uniqueIndex("user_email_unq").on(users.email),
      usernameIndex: uniqueIndex("user_username_unq").on(users.username),
    };
  },
);

export type User = InferModel<typeof users>;
export type NewUser = InferModel<typeof users, "insert">;

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

export const followStatusEnum = pgEnum("follow_status", [
  "none",
  "pending",
  "following",
]);

export const follows = pgTable(
  "follow",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fromUserId: bigint("from_user_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    toUserId: bigint("to_user_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    status: followStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (follows) => {
    return {
      follows: uniqueIndex("follow_unq").on(
        follows.fromUserId,
        follows.toUserId,
      ),
    };
  },
);

export const followsRelations = relations(follows, ({ one, many }) => ({
  fromUser: one(users, {
    fields: [follows.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [follows.toUserId],
    references: [users.id],
  }),
}));

export type Follow = InferModel<typeof follows>;
export type NewFollow = InferModel<typeof follows, "insert">;

export type EntityType = "brand" | "distiller" | "bottler";

export const entityTypeEnum = pgEnum("entity_type", [
  "brand",
  "distiller",
  "bottler",
]);

export const entities = pgTable(
  "entity",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    name: text("name").notNull(),
    country: text("country"),
    region: text("region"),
    type: entityTypeEnum("type").array().notNull(),

    location: geography("location"),

    totalBottles: bigint("total_bottles", { mode: "number" })
      .default(0)
      .notNull(),
    totalTastings: bigint("total_tastings", { mode: "number" })
      .default(0)
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (entities) => {
    return {
      nameIndex: uniqueIndex("entity_name_unq").on(entities.name),
    };
  },
);

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  distillersToBottles: many(bottlesToDistillers),
  brandsToBottles: many(bottles),
  createdBy: one(users, {
    fields: [entities.createdById],
    references: [users.id],
  }),
}));

export type Entity = InferModel<typeof entities>;
export type NewEntity = InferModel<typeof entities, "insert">;

export const categoryEnum = pgEnum("category", CATEGORY_LIST);
// type MyEnum = InferModel<typeof myTable>["myColWithEnum”]

export const bottles = pgTable(
  "bottle",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    category: categoryEnum("category"),
    brandId: bigint("brand_id", { mode: "number" })
      .references(() => entities.id)
      .notNull(),
    bottlerId: bigint("bottler_id", { mode: "number" }).references(
      () => entities.id,
    ),
    statedAge: smallint("stated_age"),

    totalTastings: bigint("total_tastings", { mode: "number" })
      .default(0)
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (bottles) => {
    return {
      unique: uniqueIndex("bottle_brand_unq").on(bottles.name, bottles.brandId),
      uniqueName: uniqueIndex("bottle_name_unq").on(bottles.fullName),
    };
  },
);

export const bottlesRelations = relations(bottles, ({ one, many }) => ({
  brand: one(entities, {
    fields: [bottles.brandId],
    references: [entities.id],
  }),
  bottler: one(entities, {
    fields: [bottles.bottlerId],
    references: [entities.id],
  }),
  bottlesToDistillers: many(bottlesToDistillers),
  createdBy: one(users, {
    fields: [bottles.createdById],
    references: [users.id],
  }),
}));

export type Bottle = InferModel<typeof bottles>;
export type NewBottle = InferModel<typeof bottles, "insert">;

export const bottlesToDistillers = pgTable(
  "bottle_distiller",
  {
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    distillerId: bigint("distiller_id", { mode: "number" })
      .references(() => entities.id)
      .notNull(),
  },
  (bottlesToDistillers) => {
    return {
      bottleDistillerId: primaryKey(
        bottlesToDistillers.bottleId,
        bottlesToDistillers.distillerId,
      ),
    };
  },
);

export const bottlesToDistillersRelations = relations(
  bottlesToDistillers,
  ({ one }) => ({
    bottle: one(bottles, {
      fields: [bottlesToDistillers.bottleId],
      references: [bottles.id],
    }),
    distiller: one(entities, {
      fields: [bottlesToDistillers.distillerId],
      references: [entities.id],
    }),
  }),
);

export type BottlesToDistillers = InferModel<typeof bottlesToDistillers>;
export type NewBottlesToDistillers = InferModel<
  typeof bottlesToDistillers,
  "insert"
>;

export const bottleTags = pgTable(
  "bottle_tag",
  {
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    tag: varchar("tag", { length: 64 }).notNull(),
    count: integer("count").default(0).notNull(),
  },
  (bottleTags) => {
    return {
      pk: primaryKey(bottleTags.bottleId, bottleTags.tag),
    };
  },
);

export const bottleTagsRelations = relations(bottleTags, ({ one }) => ({
  bottle: one(bottles, {
    fields: [bottleTags.bottleId],
    references: [bottles.id],
  }),
}));

export type BottleTag = InferModel<typeof bottleTags>;
export type NewBottleTag = InferModel<typeof bottleTags, "insert">;

export const collections = pgTable(
  "collection",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    totalBottles: bigint("total_bottles", { mode: "number" })
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (collections) => {
    return {
      collectionIndex: uniqueIndex("collection_name_unq").on(
        collections.name,
        collections.createdById,
      ),
    };
  },
);

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  collectionBottles: many(collectionBottles),
  createdBy: one(users, {
    fields: [collections.createdById],
    references: [users.id],
  }),
}));

export type Collection = InferModel<typeof collections>;
export type NewCollection = InferModel<typeof collections, "insert">;

export const collectionBottles = pgTable(
  "collection_bottle",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    collectionId: bigint("collection_id", { mode: "number" })
      .references(() => collections.id)
      .notNull(),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (collectionBottles) => {
    return {
      collectionDistillerId: uniqueIndex("collection_bottle_unq").on(
        collectionBottles.collectionId,
        collectionBottles.bottleId,
      ),
    };
  },
);

export const collectionBottlesRelations = relations(
  collectionBottles,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionBottles.collectionId],
      references: [collections.id],
    }),
    bottle: one(bottles, {
      fields: [collectionBottles.bottleId],
      references: [bottles.id],
    }),
  }),
);

export type CollectionBottle = InferModel<typeof collectionBottles>;
export type NewCollectionBottle = InferModel<
  typeof collectionBottles,
  "insert"
>;

export const servingStyleEnum = pgEnum("servingStyle", SERVING_STYLE_LIST);

export const tastings = pgTable(
  "tasting",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    tags: varchar("tags", { length: 64 })
      .array()
      .default(sql`array[]::varchar[]`)
      .notNull(),
    rating: doublePrecision("rating"),
    imageUrl: text("image_url"),
    notes: text("notes"),
    servingStyle: servingStyleEnum("serving_style"),

    comments: integer("comments").default(0).notNull(),
    toasts: integer("toasts").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (tastings) => {
    return {
      tasting: uniqueIndex("tasting_unq").on(
        tastings.bottleId,
        tastings.createdById,
        tastings.createdAt,
      ),
    };
  },
);

export const tastingsRelations = relations(tastings, ({ one }) => ({
  bottle: one(bottles, {
    fields: [tastings.bottleId],
    references: [bottles.id],
  }),
  createdBy: one(users, {
    fields: [tastings.createdById],
    references: [users.id],
  }),
}));

export type Tasting = InferModel<typeof tastings>;
export type NewTasting = InferModel<typeof tastings, "insert">;

export const toasts = pgTable(
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

export type Toast = InferModel<typeof toasts>;
export type NewToast = InferModel<typeof toasts, "insert">;

export const comments = pgTable(
  // oops named this wrong sorry
  "comments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tastingId: bigint("tasting_id", { mode: "number" })
      .references(() => tastings.id)
      .notNull(),
    comment: text("comment").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (comments) => {
    return {
      comment: uniqueIndex("comment_unq").on(
        comments.tastingId,
        comments.createdById,
        comments.createdAt,
      ),
    };
  },
);

export const commentsRelations = relations(comments, ({ one }) => ({
  tasting: one(tastings, {
    fields: [comments.tastingId],
    references: [tastings.id],
  }),
  createdBy: one(users, {
    fields: [comments.createdById],
    references: [users.id],
  }),
}));

export type Comment = InferModel<typeof comments>;
export type NewComment = InferModel<typeof comments, "insert">;

export type ObjectType =
  | "bottle"
  | "comment"
  | "entity"
  | "tasting"
  | "toast"
  | "follow";

export const objectTypeEnum = pgEnum("object_type", [
  "bottle",
  "comment",
  "entity",
  "tasting",
  "toast",
  "follow",
]);

export const changeTypeEnum = pgEnum("type", ["add", "update", "delete"]);

export const changes = pgTable("change", {
  id: bigserial("id", { mode: "number" }).primaryKey(),

  objectId: bigint("object_id", { mode: "number" }).notNull(),
  objectType: objectTypeEnum("object_type").notNull(),
  type: changeTypeEnum("type").default("add").notNull(),
  displayName: text("display_name"),
  data: jsonb("data").default({}).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdById: bigint("created_by_id", { mode: "number" })
    .references(() => users.id)
    .notNull(),
});

export const changesRelations = relations(changes, ({ one }) => ({
  createdBy: one(users, {
    fields: [changes.createdById],
    references: [users.id],
  }),
}));

export type Change = InferModel<typeof changes>;
export type NewChange = InferModel<typeof changes, "insert">;

// this table is intended to delete notifications which are older than X time and read
export const notifications = pgTable(
  "notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    fromUserId: bigint("from_user_id", { mode: "number" }).references(
      () => users.id,
    ),
    // tracks ref of what owns the notification
    objectId: bigint("object_id", { mode: "number" }).notNull(),
    objectType: objectTypeEnum("object_type").notNull(),
    // does not default as it should be set to object's createdAt timestamp
    createdAt: timestamp("created_at").notNull(),

    read: boolean("read").default(false).notNull(),
  },
  (notifications) => {
    return {
      notificationUnique: uniqueIndex("notifications_unq").on(
        notifications.userId,
        notifications.objectId,
        notifications.objectType,
        notifications.createdAt,
      ),
    };
  },
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  fromUser: one(users, {
    fields: [notifications.fromUserId],
    references: [users.id],
  }),
}));

export type Notification = InferModel<typeof notifications>;
export type NewNotification = InferModel<typeof notifications, "insert">;

export const badgeTypeEnum = pgEnum("badge_type", [
  "bottle",
  "region",
  "category",
]);

export const badges = pgTable(
  "badges",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }),
    type: badgeTypeEnum("type").notNull(),
    config: jsonb("config").$type<Record<string, any>>().default({}).notNull(),
  },
  (badges) => {
    return {
      name: uniqueIndex("badge_name_unq").on(badges.name),
    };
  },
);

export type Badge = InferModel<typeof badges>;
export type NewBadge = InferModel<typeof badges, "insert">;

export const badgeAwards = pgTable(
  "badge_award",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    badgeId: bigint("badge_id", { mode: "number" })
      .references(() => badges.id)
      .notNull(),
    userId: bigint("user_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
    xp: smallint("points").default(0),
    level: smallint("level").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (badgeAwards) => {
    return {
      constraint: uniqueIndex("badge_award_unq").on(
        badgeAwards.badgeId,
        badgeAwards.userId,
      ),
    };
  },
);

export const badgeAwardsRelations = relations(badgeAwards, ({ one }) => ({
  badge: one(badges, {
    fields: [badgeAwards.badgeId],
    references: [badges.id],
  }),
  user: one(users, {
    fields: [badgeAwards.userId],
    references: [users.id],
  }),
}));

export type BadgeAward = InferModel<typeof badgeAwards>;
export type NewBadgeAward = InferModel<typeof badgeAwards, "insert">;

export const priceScraperTypeEnum = pgEnum(
  "price_scraper_type",
  STORE_TYPE_LIST,
);

export const stores = pgTable(
  "store",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: priceScraperTypeEnum("type").notNull(),
    name: text("name").notNull(),
    country: text("country"),
    lastRunAt: timestamp("last_run_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (stores) => {
    return {
      type: uniqueIndex("store_type").on(stores.type),
    };
  },
);

export type Store = InferModel<typeof stores>;
export type NewStore = InferModel<typeof stores, "insert">;

export const storePrices = pgTable(
  "store_price",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    storeId: bigint("store_id", { mode: "number" })
      .references(() => stores.id)
      .notNull(),
    name: text("name").notNull(),
    bottleId: bigint("bottle_id", { mode: "number" }).references(
      () => bottles.id,
    ),
    price: integer("price").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (storePrices) => {
    return {
      storeName: uniqueIndex("store_price_unq_name").on(
        storePrices.storeId,
        storePrices.name,
      ),
    };
  },
);

export const storePricesRelations = relations(storePrices, ({ one }) => ({
  bottle: one(bottles, {
    fields: [storePrices.bottleId],
    references: [bottles.id],
  }),
  store: one(stores, {
    fields: [storePrices.storeId],
    references: [stores.id],
  }),
}));

export type StorePrice = InferModel<typeof storePrices>;
export type NewStorePrice = InferModel<typeof storePrices, "insert">;

export const storePriceHistories = pgTable(
  "store_price_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    priceId: bigint("price_id", { mode: "number" })
      .references(() => storePrices.id)
      .notNull(),
    price: integer("price").notNull(),
    date: date("date").defaultNow().notNull(),
  },
  (storePriceHistories) => {
    return {
      priceDate: uniqueIndex("store_price_history_unq").on(
        storePriceHistories.priceId,
        storePriceHistories.date,
      ),
    };
  },
);

export const storePriceHistoriesRelations = relations(
  storePriceHistories,
  ({ one }) => ({
    price: one(storePrices, {
      fields: [storePriceHistories.priceId],
      references: [storePrices.id],
    }),
  }),
);

export type StorePriceHistory = InferModel<typeof storePriceHistories>;
export type NewStorePriceHistory = InferModel<
  typeof storePriceHistories,
  "insert"
>;
