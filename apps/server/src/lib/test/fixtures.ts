import { faker } from "@faker-js/faker";
import type * as dbSchema from "@peated/server/db/schema";
import { generatePublicId } from "@peated/server/lib/publicId";
import { type ExternalSiteType } from "@peated/server/types";
import { eq, sql } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";
import {
  CATEGORY_LIST,
  DEFAULT_TAGS,
  EXTERNAL_SITE_TYPE_LIST,
} from "../../constants";
import type { DatabaseType } from "../../db";
import { db as dbConn } from "../../db";
import type {
  NewBadge,
  NewBottle,
  NewBottleAlias,
  NewComment,
  NewEntity,
  NewExternalSite,
  NewFlight,
  NewFollow,
  NewReview,
  NewStorePrice,
  NewStorePriceHistory,
  NewTasting,
  NewToast,
  NewUser,
} from "../../db/schema";
import {
  badges,
  bottleAliases,
  bottleTags,
  bottles,
  bottlesToDistillers,
  changes,
  collections,
  comments,
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
import { choose, random, sample } from "../rand";
import { toTitleCase } from "../strings";

export async function loadFixture(...paths: string[]) {
  const data = await readFile(
    path.join(__dirname, "..", "..", "..", "__fixtures__", ...paths),
  );
  return data.toString();
}

export const User = async (
  { ...data }: Partial<Omit<NewUser, "id">> = {},
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
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Follow = async (
  { ...data }: Partial<NewFollow> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Follow> => {
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(follows)
      .values({
        fromUserId: data.fromUserId || (await User({}, tx)).id,
        toUserId: data.toUserId || (await User({}, tx)).id,
        status: "following",
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Entity = async (
  { ...data }: Partial<Omit<NewEntity, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Entity> => {
  const name = faker.company.name();
  // XXX(dcramer): not ideal
  const existing = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.name, name),
  });
  if (existing) return existing;

  return await db.transaction(async (tx) => {
    const [entity] = await tx
      .insert(entities)
      .values({
        name,
        country: faker.location.country(),
        type: ["brand", "distiller"],
        ...data,
        createdById: data.createdById || (await User({}, tx)).id,
      })
      .returning();

    if (!entity) throw new Error("Unable to create fixture");

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

export const Bottle = async (
  {
    distillerIds = [],
    ...data
  }: Partial<Omit<NewBottle, "id">> & {
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

    const [bottle] = await tx
      .insert(bottles)
      .values({
        category: choose([...CATEGORY_LIST, undefined]),
        statedAge: choose([undefined, 3, 10, 12, 15, 18, 20, 25]),
        ...data,
        name,
        fullName: `${brand.name} ${name}`,
        brandId: brand.id,
        createdById: data.createdById || (await User({}, tx)).id,
      })
      .returning();

    if (!bottle) throw new Error("Unable to create fixture");

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
  { ...data }: Partial<NewBottleAlias> = {},
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
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Tasting = async (
  { ...data }: Partial<Omit<NewTasting, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Tasting> => {
  return await db.transaction(async (tx) => {
    const [result] = await tx
      .insert(tastings)
      .values({
        notes: faker.lorem.sentence(),
        rating: faker.number.float({ min: 1, max: 5 }),
        tags: sample(DEFAULT_TAGS, random(1, 5)),
        ...data,
        bottleId: data.bottleId || (await Bottle({}, tx)).id,
        createdById: data.createdById || (await User({}, tx)).id,
      })
      .returning();

    if (!result) throw new Error("Unable to create fixture");

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
  { ...data }: Partial<Omit<NewToast, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Toast> => {
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(toasts)
      .values({
        createdById: data.createdById || (await User({}, tx)).id,
        tastingId: data.tastingId || (await Tasting({}, tx)).id,
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Comment = async (
  { ...data }: Partial<Omit<NewComment, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.Comment> => {
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(comments)
      .values({
        createdById: data.createdById || (await User({}, tx)).id,
        tastingId: data.tastingId || (await Tasting({}, tx)).id,
        comment: faker.lorem.sentences(random(2, 5)),
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Flight = async (
  {
    bottles,
    ...data
  }: Partial<
    Omit<
      NewFlight & {
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
        ...data,
      })
      .returning();
    if (!flight) throw new Error("Unable to create fixture");
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
  { ...data }: Partial<Omit<NewBadge, "id">> = {},
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
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const ExternalSite = async (
  { ...data }: Partial<Omit<NewExternalSite, "id">> = {},
  db: DatabaseType = dbConn,
): Promise<dbSchema.ExternalSite> => {
  if (!data.type) data.type = choose([...EXTERNAL_SITE_TYPE_LIST]);
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
      ...(data as Omit<NewExternalSite, "name">),
    })
    .returning();
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const StorePrice = async (
  { ...data }: Partial<Omit<NewStorePrice, "id">> = {},
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
      data.bottleId = bottle.id;
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
          updatedAt: sql`NOW()`,
        },
      })
      .returning();

    if (!price) throw new Error("Unable to create fixture");

    await tx
      .insert(storePriceHistories)
      .values({
        priceId: price.id,
        price: price.price,
        volume: price.volume,
        date: sql`CURRENT_DATE`,
      })
      .onConflictDoNothing();

    return price;
  });
};

export const StorePriceHistory = async (
  { ...data }: Partial<Omit<NewStorePriceHistory, "id">> = {},
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
        ...data,
        priceId: data.priceId || (await StorePrice({}, tx)).id,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Review = async (
  { ...data }: Partial<Omit<NewReview, "id">> = {},
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
      data.bottleId = bottle.id;
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
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create fixture");
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
      ...(data as Omit<dbSchema.NewCollection, "name">),
    })
    .returning();
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const AuthToken = async (
  { user }: { user?: dbSchema.User | null } = {},
  db: DatabaseType = dbConn,
): Promise<string> => {
  if (!user) user = await User({}, db);

  return await createAccessToken(user);
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
