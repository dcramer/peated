import { faker } from "@faker-js/faker";
import * as dbSchema from "@peated/server/db/schema";
import { generatePublicId } from "@peated/server/lib/publicId";
import { type ExternalSiteType } from "@peated/server/types";
import slugify from "@sindresorhus/slugify";
import { eq, inArray, sql } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";
import {
  CATEGORY_LIST,
  EXTERNAL_SITE_TYPE_LIST,
  FLAVOR_PROFILES,
  TAG_CATEGORIES,
} from "../../constants";
import type { DatabaseType } from "../../db";
import { db as dbConn } from "../../db";
import {
  badges,
  bottleAliases,
  bottleTags,
  bottles,
  bottlesToDistillers,
  changes,
  collections,
  comments,
  countries,
  entities,
  externalSites,
  flightBottles,
  flights,
  follows,
  reviews,
  storePriceHistories,
  storePrices,
  tastings,
  toasts,
  users,
} from "../../db/schema";
import { createAccessToken } from "../auth";
import { generateUniqHash } from "../bottleHash";
import { choose, random, sample } from "../rand";
import { buildBottleSearchVector, buildEntitySearchVector } from "../search";
import { toTitleCase } from "../strings";

export async function loadFixture(...paths: string[]) {
  const data = await readFile(
    path.join(__dirname, "..", "..", "..", "__fixtures__", ...paths),
  );
  return data.toString();
}

export const User = async (
  { ...data }: Partial<Omit<dbSchema.NewUser, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.User> => {
  const firstName = data.displayName?.split(" ")[0] || faker.person.firstName();

  const [result] = await db
    .insert(users)
    .values({
      displayName: firstName,
      email: faker.internet.email({
        firstName,
      }),
      username: `${faker.internet.userName().toLowerCase()}${faker.number.int(
        10000,
      )}`,
      admin: false,
      mod: false,
      active: true,
      createdAt: new Date(),
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create User fixture");
  return result;
};

export const Follow = async (
  { ...data }: Partial<dbSchema.NewFollow> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Follow> => {
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(follows)
      .values({
        fromUserId: data.fromUserId || (await User({}, tx)).id,
        toUserId: data.toUserId || (await User({}, tx)).id,
        status: "following",
        createdAt: new Date(),
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create Follow fixture");
  return result;
};

export const Country = async (
  { ...data }: Partial<dbSchema.NewCountry> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Country> => {
  if (!data.name) data.name = faker.location.country();
  let [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(countries)
      .values({
        name: "", // cant be asked to fix TS
        slug: slugify(data.name as string),
        ...data,
      })
      .onConflictDoNothing()
      .returning();
  });
  if (!result) {
    [result] = await db
      .select()
      .from(countries)
      .where(eq(countries.name, data.name));
  }
  if (!result) throw new Error("Unable to create Country fixture");
  return result;
};

export const Region = async (
  { ...data }: Partial<dbSchema.NewRegion> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Region> => {
  if (!data.name) data.name = faker.location.state();
  let [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(dbSchema.regions)
      .values({
        countryId: data.countryId || (await Country({}, tx)).id,
        name: "", // cant be asked to fix TS
        slug: slugify(data.name as string),
        ...data,
      })
      .onConflictDoNothing()
      .returning();
  });
  if (!result) {
    [result] = await db
      .select()
      .from(dbSchema.regions)
      .where(eq(dbSchema.regions.name, data.name));
  }
  if (!result) throw new Error("Unable to create Region fixture");
  return result;
};

export const Entity = async (
  { ...data }: Partial<Omit<dbSchema.NewEntity, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Entity> => {
  const name = data.name || faker.company.name();
  // XXX(dcramer): not ideal
  const existing = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.name, name),
  });
  if (existing) return existing;

  return await db.transaction(async (tx) => {
    const entityData: dbSchema.NewEntity = {
      name,
      countryId: data.countryId ?? (await Country({}, tx)).id,
      type: ["brand", "distiller"],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      createdById: data.createdById || (await User({}, tx)).id,
    };

    const searchVector = buildEntitySearchVector(entityData);

    const [entity] = await tx
      .insert(entities)
      .values({ ...entityData, searchVector })
      .returning();

    if (!entity) throw new Error("Unable to create Entity fixture");

    await tx.insert(dbSchema.entityAliases).values({
      entityId: entity.id,
      name: entity.name,
      createdAt: entity.createdAt,
    });

    await tx.insert(changes).values({
      objectId: entity.id,
      objectType: "entity",
      type: "add",
      displayName: entity.name,
      createdAt: entity.createdAt,
      createdById: entity.createdById,
      data: entity,
    });

    return entity;
  });
};

export const EntityAlias = async (
  { ...data }: Partial<dbSchema.NewEntityAlias> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.EntityAlias> => {
  const [result] = await db.transaction(async (tx) => {
    return await db
      .insert(dbSchema.entityAliases)
      .values({
        entityId: data.entityId || (await Entity({}, tx)).id,
        name: `${toTitleCase(
          choose([
            faker.company.buzzNoun(),
            `${faker.company.buzzAdjective()} ${faker.company.buzzNoun()}`,
          ]),
        )} #${faker.number.int(100)}`,
        createdAt: new Date(),
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create EntityAlias fixture");
  return result;
};

export const Bottle = async (
  {
    distillerIds = [],
    ...data
  }: Partial<Omit<dbSchema.NewBottle, "id">> & {
    distillerIds?: number[];
  } = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Bottle> => {
  return await db.transaction(async (tx) => {
    const brand = (
      data.brandId
        ? await tx.query.entities.findFirst({
            where: (entities, { eq }) =>
              eq(entities.id, data.brandId as number),
          })
        : await Entity(
            {
              totalBottles: 1,
            },
            tx,
          )
    ) as dbSchema.Entity;

    const name =
      data.name ??
      `${toTitleCase(
        choose([
          faker.company.buzzNoun(),
          `${faker.company.buzzAdjective()} ${faker.company.buzzNoun()}`,
        ]),
      )} #${faker.number.int(100)}`;

    const bottleData: Omit<dbSchema.NewBottle, "uniqHash"> = {
      category: choose([...CATEGORY_LIST, null, null]),
      statedAge: choose([null, null, null, null, 3, 10, 12, 15, 18, 20, 25]),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      name,
      fullName: `${brand.name} ${name}`,
      brandId: brand.id,
      createdById: data.createdById || (await User({}, tx)).id,
    };

    const distillerList = distillerIds.length
      ? await tx.query.entities.findMany({
          where: inArray(entities.id, distillerIds),
        })
      : [];

    const bottler = bottleData.bottlerId
      ? await tx.query.entities.findFirst({
          where: eq(entities.id, bottleData.bottlerId),
        })
      : undefined;

    const searchVector = buildBottleSearchVector(
      bottleData,
      brand,
      [],
      bottler,
      distillerList,
    );

    const [bottle] = await tx
      .insert(bottles)
      .values({
        ...bottleData,
        searchVector,
        uniqHash: generateUniqHash(bottleData),
      })
      .returning();

    if (!bottle) throw new Error("Unable to create Bottle fixture");

    if (!distillerIds.length) {
      for (let i = 0; i < choose([0, 1, 1, 1, 2]); i++) {
        await tx.insert(bottlesToDistillers).values({
          bottleId: bottle.id,
          distillerId: (
            await Entity({ type: ["distiller"], totalBottles: 1 }, tx)
          ).id,
        });
      }
    } else {
      for (const d of distillerIds) {
        await tx.insert(bottlesToDistillers).values({
          bottleId: bottle.id,
          distillerId: d,
        });
      }
    }

    await tx.insert(bottleAliases).values({
      bottleId: bottle.id,
      name: bottle.fullName,
      createdAt: bottle.createdAt,
    });

    await tx.insert(changes).values({
      objectId: bottle.id,
      objectType: "bottle",
      displayName: bottle.fullName,
      type: "add",
      createdAt: bottle.createdAt,
      createdById: bottle.createdById,
      data: bottle,
    });

    return bottle;
  });
};

export const BottleAlias = async (
  { ...data }: Partial<dbSchema.NewBottleAlias> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.BottleAlias> => {
  const [result] = await db.transaction(async (tx) => {
    return await db
      .insert(bottleAliases)
      .values({
        bottleId: data.bottleId || (await Bottle({}, tx)).id,
        name: `${toTitleCase(
          choose([
            faker.company.buzzNoun(),
            `${faker.company.buzzAdjective()} ${faker.company.buzzNoun()}`,
          ]),
        )} #${faker.number.int(100)}`,
        createdAt: new Date(),
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create BottleAlias fixture");
  return result;
};

export const Tasting = async (
  { ...data }: Partial<Omit<dbSchema.NewTasting, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Tasting> => {
  return await db.transaction(async (tx) => {
    const tags = [];
    for (let i = 0; i <= random(1, 5); i++) {
      tags.push((await Tag({}, tx)).name);
    }
    const [result] = await tx
      .insert(tastings)
      .values({
        notes: faker.lorem.sentence(),
        rating: faker.number.float({ min: 1, max: 5 }),
        tags: tags,
        createdAt: new Date(),
        ...data,
        bottleId: data.bottleId || (await Bottle({}, tx)).id,
        createdById: data.createdById || (await User({}, tx)).id,
      })
      .returning();

    if (!result) throw new Error("Unable to create Tasting fixture");

    for (const tag of result.tags) {
      await tx
        .insert(bottleTags)
        .values({
          bottleId: result.bottleId,
          tag,
          count: 1,
        })
        .onConflictDoUpdate({
          target: [bottleTags.bottleId, bottleTags.tag],
          set: {
            count: sql<number>`${bottleTags.count} + 1`,
          },
        });
    }

    return result;
  });
};

export const Toast = async (
  { ...data }: Partial<Omit<dbSchema.NewToast, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Toast> => {
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(toasts)
      .values({
        createdById: data.createdById || (await User({}, tx)).id,
        tastingId: data.tastingId || (await Tasting({}, tx)).id,
        createdAt: new Date(),
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create Toast fixture");
  return result;
};

export const Comment = async (
  { ...data }: Partial<Omit<dbSchema.NewComment, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Comment> => {
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(comments)
      .values({
        createdById: data.createdById || (await User({}, tx)).id,
        tastingId: data.tastingId || (await Tasting({}, tx)).id,
        comment: faker.lorem.sentences(random(2, 5)),
        createdAt: new Date(),
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create Comment fixture");
  return result;
};

export const Flight = async (
  {
    bottles,
    ...data
  }: Partial<
    Omit<
      dbSchema.NewFlight & {
        bottles: number[];
      },
      "id"
    >
  > = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Flight> => {
  return await db.transaction(async (tx) => {
    const [flight] = await tx
      .insert(flights)
      .values({
        publicId: generatePublicId(),
        name: faker.word.noun(),
        createdById: data.createdById || (await User({}, tx)).id,
        createdAt: new Date(),
        ...data,
      })
      .returning();
    if (!flight) throw new Error("Unable to create Flight fixture");
    if (bottles) {
      for (const bottleId of bottles) {
        await tx.insert(flightBottles).values({
          flightId: flight.id,
          bottleId: bottleId,
        });
      }
    }
    return flight;
  });
};

export const Badge = async (
  { ...data }: Partial<Omit<dbSchema.NewBadge, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Badge> => {
  const [result] = await db
    .insert(badges)
    .values({
      name: faker.word.noun(),
      type: "category",
      config: {
        category: "single_malt",
      },
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create Badge fixture");
  return result;
};

export const ExternalSite = async (
  { ...data }: Partial<Omit<dbSchema.NewExternalSite, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.ExternalSite> => {
  if (!data.type) data.type = choose(EXTERNAL_SITE_TYPE_LIST);
  // XXX(dcramer): not ideal
  const existing = await db.query.externalSites.findFirst({
    where: (externalSites, { eq }) =>
      eq(externalSites.type, data.type as ExternalSiteType),
  });
  if (existing) return existing;

  const [result] = await db
    .insert(externalSites)
    .values({
      name: faker.company.name(),
      ...(data as Omit<dbSchema.NewExternalSite, "name">),
    })
    .returning();
  if (!result) throw new Error("Unable to create ExternalSite fixture");
  return result;
};

export const StorePrice = async (
  { ...data }: Partial<Omit<dbSchema.NewStorePrice, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.StorePrice> => {
  return await db.transaction(async (tx) => {
    if (!data.name) {
      const bottle = data.bottleId
        ? await tx.query.bottles.findFirst({
            where: eq(bottles.id, data.bottleId),
            with: { brand: true },
          })
        : await Bottle({}, tx);
      if (!bottle) throw new Error("Unexpected");
      // this lets us pass in something that should match, but hasnt
      if (data.bottleId === undefined) data.bottleId = bottle.id;
      data.name = bottle.fullName;
    }

    if (!data.price)
      data.price =
        parseInt(faker.finance.amount({ min: 50, max: 200, dec: 0 }), 10) * 100;
    if (!data.url) data.url = faker.internet.url();

    const [price] = await tx
      .insert(storePrices)
      .values({
        // lazy fix for tsc
        name: "",
        price: 0,
        volume: 750,
        url: "",
        currency: "usd",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
        externalSiteId: data.externalSiteId || (await ExternalSite({}, tx)).id,
      })
      .onConflictDoUpdate({
        target: [
          storePrices.externalSiteId,
          storePrices.name,
          storePrices.volume,
        ],
        set: {
          bottleId: data.bottleId,
          price: data.price,
          url: data.url,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!price) throw new Error("Unable to create StorePrice fixture");

    await tx
      .insert(storePriceHistories)
      .values({
        priceId: price.id,
        price: price.price,
        volume: price.volume,
        currency: price.currency,
        // TODO: mock
        date: sql`CURRENT_DATE`,
      })
      .onConflictDoNothing();

    return price;
  });
};

export const StorePriceHistory = async (
  { ...data }: Partial<Omit<dbSchema.NewStorePriceHistory, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.StorePriceHistory> => {
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(storePriceHistories)
      .values({
        price:
          parseInt(faker.finance.amount({ min: 50, max: 200, dec: 0 }), 10) *
          100,
        volume: 750,
        // TODO: mock
        // date: new Date(),
        ...data,
        priceId: data.priceId || (await StorePrice({}, tx)).id,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create StorePriceHistory fixture");
  return result;
};

export const Review = async (
  { ...data }: Partial<Omit<dbSchema.NewReview, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Review> => {
  const [result] = await db.transaction(async (tx) => {
    if (!data.name) {
      const bottle = data.bottleId
        ? await tx.query.bottles.findFirst({
            where: eq(bottles.id, data.bottleId),
            with: { brand: true },
          })
        : await Bottle({}, tx);
      if (!bottle) throw new Error("Unexpected");
      // this lets us pass in something that should match, but hasnt
      if (data.bottleId === undefined) data.bottleId = bottle.id;
      data.name = bottle.fullName;
    }

    return await tx
      .insert(reviews)
      .values({
        name: "",
        externalSiteId: data.externalSiteId || (await ExternalSite({}, tx)).id,
        rating: faker.number.int({ min: 59, max: 100 }),
        url: faker.internet.url(),
        issue: "Default",
        createdAt: new Date(),
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create Review fixture");
  return result;
};

export const Collection = async (
  { ...data }: Partial<Omit<dbSchema.NewCollection, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Collection> => {
  const [result] = await db
    .insert(collections)
    .values({
      name: faker.company.name(),
      createdAt: new Date(),
      ...(data as Omit<dbSchema.NewCollection, "name">),
    })
    .returning();
  if (!result) throw new Error("Unable to create Collection fixture");
  return result;
};

export const Tag = async (
  { ...data }: Partial<Omit<dbSchema.NewTag, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Tag> => {
  const name = data.name || faker.word.adjective().toLowerCase();

  // XXX(dcramer): not ideal
  const existing = await db.query.tags.findFirst({
    where: (tags, { eq }) => eq(tags.name, name),
  });
  if (existing) return existing;

  const [result] = await db
    .insert(dbSchema.tags)
    .values({
      name,
      tagCategory: choose(TAG_CATEGORIES),
      flavorProfiles: sample(FLAVOR_PROFILES, random(1, 2)),
      ...(data as Omit<
        dbSchema.NewTag,
        "name" | "tagCategory" | "flavorProfiles"
      >),
    })
    .returning();
  if (!result) throw new Error("Unable to create Tag fixture");
  return result;
};

export const AuthToken = async (
  { user }: { user?: dbSchema.User | null } = {},
  db: DatabaseType = dbConn,
): Promise<string> => {
  return await createAccessToken(user ?? (await User({}, db)));
};

export const AuthenticatedHeaders = async (
  {
    user,
    mod,
    admin,
  }: {
    user?: dbSchema.User | null;
    mod?: boolean;
    admin?: boolean;
  } = {},
  db: DatabaseType = dbConn,
) => {
  if (!user && admin) {
    user = await User({ admin: true });
  } else if (!user && mod) {
    user = await User({ mod: true });
  }
  return {
    Authorization: `Bearer ${await AuthToken({ user }, db)}`,
  };
};

export const SampleSquareImage = async () => {
  return new Blob([await readFile(await SampleSquareImagePath())]);
};

export const SampleSquareImagePath = async () => {
  return path.join(__dirname, "assets", "sample-square-image.jpg");
};
