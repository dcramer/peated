import { InferModel } from "drizzle-orm";
import {
  pgTable,
  bigserial,
  text,
  varchar,
  uniqueIndex,
  boolean,
  timestamp,
  pgEnum,
  bigint,
  smallint,
  doublePrecision,
  primaryKey,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "user",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: text("email").notNull(),
    passwordHash: varchar("password_hash", { length: 256 }),
    displayName: text("display_name"),
    pictureUrl: text("picture_url"),

    active: boolean("active").default(true).notNull(),
    admin: boolean("admin").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (users) => {
    return {
      emailIndex: uniqueIndex("user_email_unq").on(users.email),
    };
  }
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
        identities.externalId
      ),
    };
  }
);

export const entityTypeEnum = pgEnum("entity_type", ["brand", "distiller"]);

export const entities = pgTable(
  "entity",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    name: text("name").notNull(),
    country: text("country"),
    region: text("region"),
    type: entityTypeEnum("type").array().notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (entities) => {
    return {
      nameIndex: uniqueIndex("entity_name_unq").on(entities.name),
    };
  }
);

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

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (bottles) => {
    return {
      bottleBrandIndex: uniqueIndex("bottle_brand_unq").on(
        bottles.name,
        bottles.brandId
      ),
    };
  }
);

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
        bottlesToDistillers.distillerId
      ),
    };
  }
);

export const editions = pgTable(
  "edition",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    name: varchar("name", { length: 255 }).notNull(),
    barrel: smallint("barrel"),
    bottleId: bigint("bottle_id", { mode: "number" })
      .references(() => bottles.id)
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: bigint("created_by_id", { mode: "number" })
      .references(() => users.id)
      .notNull(),
  },
  (editions) => {
    return {
      editionIndex: uniqueIndex("edition_unq").on(
        editions.bottleId,
        editions.name,
        editions.barrel
      ),
    };
  }
);

export type Edition = InferModel<typeof editions>;
export type NewEdition = InferModel<typeof editions, "insert">;

export const tastings = pgTable("tasting", {
  id: bigserial("id", { mode: "number" }).primaryKey(),

  bottleId: bigint("bottle_id", { mode: "number" })
    .references(() => bottles.id)
    .notNull(),
  editionId: bigint("edition_id", { mode: "number" }).references(
    () => bottles.id
  ),

  comments: text("comments"),
  tags: text("tags").array(),
  rating: doublePrecision("rating").notNull(),
  imageUrl: text("image_url"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdById: bigint("created_by_id", { mode: "number" })
    .references(() => users.id)
    .notNull(),
});

export type Tasting = InferModel<typeof tastings>;
export type NewTasting = InferModel<typeof tastings, "insert">;

export const objectTypeEnum = pgEnum("object_type", [
  "bottle",
  "edition",
  "entity",
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

export type Change = InferModel<typeof changes>;
export type NewChange = InferModel<typeof changes, "insert">;
