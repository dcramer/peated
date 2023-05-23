import { InferModel, relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "user",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: varchar("password_hash", { length: 256 }),
    displayName: text("display_name"),
    pictureUrl: text("picture_url"),

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

export type Category =
  | "blend"
  | "bourbon"
  | "rye"
  | "single_grain"
  | "single_malt"
  | "spirit";

export const categoryEnum = pgEnum("category", [
  "blend",
  "bourbon",
  "rye",
  "single_grain",
  "single_malt",
  "spirit",
]);
// type MyEnum = InferModel<typeof myTable>["myColWithEnum”]

export const bottles = pgTable(
  "bottle",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    category: categoryEnum("category"),
    brandId: bigint("brand_id", { mode: "number" })
      .references(() => entities.id)
      .notNull(),
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
      bottleBrandIndex: uniqueIndex("bottle_brand_unq").on(
        bottles.name,
        bottles.brandId,
      ),
    };
  },
);

export const bottlesRelations = relations(bottles, ({ one, many }) => ({
  brand: one(entities, {
    fields: [bottles.brandId],
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

    vintageFingerprint: varchar("vintage_fingerprint", { length: 128 }),
    series: varchar("series", { length: 255 }),
    vintageYear: smallint("vintage_year"),
    barrel: smallint("barrel"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (collectionBottles) => {
    return {
      collectionDistillerId: uniqueIndex("collection_bottle_unq").on(
        collectionBottles.collectionId,
        collectionBottles.bottleId,
        collectionBottles.vintageFingerprint,
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

export const tastings = pgTable(
  "tasting",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),
    tags: text("tags").array(),
    rating: doublePrecision("rating"),
    imageUrl: text("image_url"),
    notes: text("notes"),

    series: varchar("series", { length: 255 }),
    vintageYear: smallint("vintage_year"),
    barrel: smallint("barrel"),

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

export const changes = pgTable("change", {
  id: bigserial("id", { mode: "number" }).primaryKey(),

  objectId: bigint("object_id", { mode: "number" }).notNull(),
  objectType: objectTypeEnum("object_type").notNull(),

  data: text("data").notNull(),

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
