import { faker } from "@faker-js/faker";
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
import { db } from "../../db";
import type {
  Entity as EntityType,
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
  User as UserType,
} from "../../db/schema";
import {
  badges,
  bottleAliases,
  bottleTags,
  bottles,
  bottlesToDistillers,
  changes,
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

export const User = async ({ ...data }: Partial<NewUser> = {}) => {
  const [result] = await db
    .insert(users)
    .values({
      displayName: faker.person.firstName(),
      email: faker.internet.email(),
      username: faker.internet.userName().toLowerCase(),
      admin: false,
      mod: false,
      active: true,
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Follow = async ({ ...data }: Partial<NewFollow> = {}) => {
  const [result] = await db
    .insert(follows)
    .values({
      fromUserId: data.fromUserId || (await User()).id,
      toUserId: data.toUserId || (await User()).id,
      status: "following",
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Entity = async ({ ...data }: Partial<NewEntity> = {}) => {
  const name = faker.company.name();
  // XXX(dcramer): not ideal
  const existing = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.name, name),
  });
  if (existing) return existing;

  return await db.transaction(async (tx) => {
    const [entity] = await db
      .insert(entities)
      .values({
        name,
        country: faker.location.country(),
        type: ["brand", "distiller"],
        ...data,
        createdById: data.createdById || (await User()).id,
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

export const Bottle = async ({
  distillerIds = [],
  ...data
}: Partial<NewBottle> & {
  distillerIds?: number[];
} = {}) => {
  return await db.transaction(async (tx) => {
    const brand = (
      data.brandId
        ? await db.query.entities.findFirst({
            where: (entities, { eq }) =>
              eq(entities.id, data.brandId as number),
          })
        : await Entity({
            totalBottles: 1,
          })
    ) as EntityType;

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
        createdById: data.createdById || (await User()).id,
      })
      .returning();

    if (!bottle) throw new Error("Unable to create fixture");

    if (!distillerIds.length) {
      for (let i = 0; i < choose([0, 1, 1, 1, 2]); i++) {
        await tx.insert(bottlesToDistillers).values({
          bottleId: bottle.id,
          distillerId: (await Entity({ type: ["distiller"], totalBottles: 1 }))
            .id,
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

export const BottleAlias = async ({
  ...data
}: Partial<NewBottleAlias> = {}) => {
  const [result] = await db
    .insert(bottleAliases)
    .values({
      bottleId: data.bottleId || (await Bottle()).id,
      name: `${toTitleCase(
        choose([
          faker.company.buzzNoun(),
          `${faker.company.buzzAdjective()} ${faker.company.buzzNoun()}`,
        ]),
      )} #${faker.number.int(100)}`,
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Tasting = async ({ ...data }: Partial<NewTasting> = {}) => {
  return await db.transaction(async (tx) => {
    const [result] = await tx
      .insert(tastings)
      .values({
        notes: faker.lorem.sentence(),
        rating: faker.number.float({ min: 1, max: 5 }),
        tags: sample(DEFAULT_TAGS, random(1, 5)),
        ...data,
        bottleId: data.bottleId || (await Bottle()).id,
        createdById: data.createdById || (await User()).id,
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

export const Toast = async ({ ...data }: Partial<NewToast> = {}) => {
  const [result] = await db
    .insert(toasts)
    .values({
      createdById: data.createdById || (await User()).id,
      tastingId: data.tastingId || (await Tasting()).id,
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Comment = async ({ ...data }: Partial<NewComment> = {}) => {
  const [result] = await db
    .insert(comments)
    .values({
      createdById: data.createdById || (await User()).id,
      tastingId: data.tastingId || (await Tasting()).id,
      comment: faker.lorem.sentences(random(2, 5)),
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Flight = async ({
  bottles,
  ...data
}: Partial<
  NewFlight & {
    bottles: number[];
  }
> = {}) => {
  return await db.transaction(async (tx) => {
    const [flight] = await tx
      .insert(flights)
      .values({
        publicId: generatePublicId(),
        name: faker.word.noun(),
        createdById: data.createdById || (await User()).id,
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

export const Badge = async ({ ...data }: Partial<NewBadge> = {}) => {
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

export const ExternalSite = async ({
  ...data
}: Partial<NewExternalSite> = {}) => {
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

export const StorePrice = async ({ ...data }: Partial<NewStorePrice> = {}) => {
  if (!data.name) {
    const bottle = data.bottleId
      ? await db.query.bottles.findFirst({
          where: eq(bottles.id, data.bottleId),
          with: { brand: true },
        })
      : await Bottle();
    if (!bottle) throw new Error("Unexpected");
    data.bottleId = bottle.id;
    data.name = bottle.fullName;
  }

  if (!data.price)
    data.price = parseInt(faker.finance.amount(50, 200, 0), 10) * 100;
  if (!data.url) data.url = faker.internet.url();

  return await db.transaction(async (tx) => {
    const [price] = await db
      .insert(storePrices)
      .values({
        // lazy fix for tsc
        name: "",
        price: 0,
        volume: 750,
        url: "",
        ...data,
        externalSiteId: data.externalSiteId || (await ExternalSite()).id,
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

export const StorePriceHistory = async ({
  ...data
}: Partial<NewStorePriceHistory> = {}) => {
  const [result] = await db
    .insert(storePriceHistories)
    .values({
      price: parseInt(faker.finance.amount(50, 200, 0), 10) * 100,
      volume: 750,
      ...data,
      priceId: data.priceId || (await StorePrice()).id,
    })
    .returning();
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const Review = async ({ ...data }: Partial<NewReview> = {}) => {
  if (!data.name) {
    const bottle = data.bottleId
      ? await db.query.bottles.findFirst({
          where: eq(bottles.id, data.bottleId),
          with: { brand: true },
        })
      : await Bottle();
    if (!bottle) throw new Error("Unexpected");
    data.bottleId = bottle.id;
    data.name = bottle.fullName;
  }

  const [result] = await db
    .insert(reviews)
    .values({
      name: "",
      externalSiteId: data.externalSiteId || (await ExternalSite()).id,
      rating: faker.number.int({ min: 59, max: 100 }),
      url: faker.internet.url(),
      issue: "Default",
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create fixture");
  return result;
};

export const AuthToken = async ({ user }: { user?: UserType | null } = {}) => {
  if (!user) user = await User();

  return await createAccessToken(user);
};

export const AuthenticatedHeaders = async ({
  user,
  mod,
  admin,
}: {
  user?: UserType | null;
  mod?: boolean;
  admin?: boolean;
} = {}) => {
  if (!user && admin) {
    user = await User({ admin: true });
  } else if (!user && mod) {
    user = await User({ mod: true });
  }
  return {
    Authorization: `Bearer ${await AuthToken({ user })}`,
  };
};

export const SampleSquareImage = async () => {
  return new Blob([await readFile(await SampleSquareImagePath())]);
};

export const SampleSquareImagePath = async () => {
  return path.join(__dirname, "assets", "sample-square-image.jpg");
};
