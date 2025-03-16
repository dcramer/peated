import { faker } from "@faker-js/faker";
import * as dbSchema from "@peated/server/db/schema";
import { generatePublicId } from "@peated/server/lib/publicId";
import { type ExternalSiteType } from "@peated/server/types";
import slugify from "@sindresorhus/slugify";
import { eq, inArray, or, sql } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";
import {
  CATEGORY_LIST,
  EXTERNAL_SITE_TYPE_LIST,
  FLAVOR_PROFILES,
  TAG_CATEGORIES,
} from "../../constants";
import type { AnyDatabase } from "../../db";
import { db as dbConn } from "../../db";
import {
  badgeAwards,
  badges,
  bottleAliases,
  bottles,
  bottlesToDistillers,
  bottleTags,
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
import { createAccessToken, generatePasswordHash } from "../auth";
import { mapRows } from "../db";
import { formatBottleName } from "../format";
import { normalizeBottle } from "../normalize";
import { choose, random, sample } from "../rand";
import { buildBottleSearchVector, buildEntitySearchVector } from "../search";
import { SMWS_DISTILLERY_CODES } from "../smws";
import { toTitleCase } from "../strings";

function getDistilleryNames() {
  const distilleryNames = [];

  for (
    let i = 1, distilleryName;
    (distilleryName = SMWS_DISTILLERY_CODES[i]);
    i++
  ) {
    distilleryNames.push(distilleryName);
  }

  return distilleryNames;
}

export const distilleryNames = getDistilleryNames();

const bottleNames = [
  "12-year-old",
  "15-year-old",
  "18-year-old",
  "25-year-old",
];

const bottleFlavors = [
  "Port Cask Finish",
  "Tequila Cask Finish",
  "Cabbernet Sauvignon Cask Finish",
  "Cask Strength",
  "Batch Strength",
  "Barrel Strength",
  "Single Barrel",
  "Small Batch",
  "French Oak",
  "Double Oak",
  "Bottle in Bond",
  "Peated",
  "Midnight",
  "Bourbon",
  "Single Malt",
  "American Single Malt",
  "American Prairie Bourbon",
  "Kentucky Straight Bourbon",
  "Blend",
  "Rye",
  "Pure Malt",
];

function chooseBottleName(extraDetail = false) {
  const baseName = choose([
    `${choose(bottleNames)}`,
    `${choose(bottleNames)}`,
    `${choose(bottleNames)}`,
    `${choose(bottleNames)} ${choose(bottleFlavors)}`,
    `${choose(bottleNames)} ${choose(bottleFlavors)}`,
    `${choose(bottleNames)} ${choose(bottleFlavors)}`,
  ]);
  if (extraDetail) {
    return choose([
      `${baseName} (Batch ${faker.number.int(100)})`,
      `${baseName} (Cask No. ${faker.number.int(100)})`,
      `${baseName} (${faker.number.int({ min: 1980, max: 2024 })} Release)`,
      `${baseName} (${faker.number.int({ min: 1980, max: 2017 })} Vintage)`,
      `${baseName} (${faker.number.int({ min: 1980, max: 2000 })} Vintage) (${faker.number.int({ min: 2005, max: 2024 })} Release)`,
    ]);
  }
  return baseName;
}

export async function loadFixture(...paths: string[]) {
  const data = await readFile(
    path.join(__dirname, "..", "..", "..", "__fixtures__", ...paths),
  );
  return data.toString();
}

export const User = async (
  {
    password,
    ...data
  }: {
    password?: string;
  } & Partial<Omit<dbSchema.NewUser, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.User> => {
  if (!data.username)
    data.username = `${faker.internet.userName().toLowerCase()}${faker.number.int(
      10000,
    )}`;

  if (password) {
    data.passwordHash = generatePasswordHash(password);
  }
  const [result] = await db
    .insert(users)
    .values({
      username: "",
      email: faker.internet.email({
        firstName: data.username || undefined,
        lastName: "example",
      }),
      admin: false,
      mod: false,
      active: true,
      verified: true,
      createdAt: new Date(),
      ...(data as Record<string, any>),
    })
    .returning();
  if (!result) throw new Error("Unable to create User fixture");
  return result;
};

export const Follow = async (
  { ...data }: Partial<dbSchema.NewFollow> = {},
  db: AnyDatabase = dbConn,
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
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Country> => {
  if (!data.name) data.name = faker.location.country();
  if (!data.slug) data.slug = slugify(data.name as string);
  let [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(dbSchema.countries)
      .values({
        name: "", // cant be asked to fix TS
        slug: "",
        ...data,
      })
      .onConflictDoNothing()
      .returning();
  });
  if (!result) {
    [result] = await db
      .select()
      .from(dbSchema.countries)
      .where(
        or(
          eq(sql`LOWER(${dbSchema.countries.name})`, data.name.toLowerCase()),
          eq(sql`LOWER(${dbSchema.countries.slug})`, data.slug),
        ),
      );
  }
  if (!result)
    throw new Error(
      `Unable to create Country fixture: ${data.name} - ${data.slug}`,
    );
  return result;
};

export const Region = async (
  { ...data }: Partial<dbSchema.NewRegion> = {},
  db: AnyDatabase = dbConn,
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

export const EntityOrExisting = async (
  { ...data }: Partial<Omit<dbSchema.NewEntity, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Entity> => {
  if (!data.name)
    data.name = `${faker.word.adjective().toLowerCase()} ${choose(distilleryNames)}}`;

  const existing = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.name, data.name as string),
  });
  if (existing) return existing;

  return await Entity(data, db);
};

export const Entity = async (
  { ...data }: Partial<Omit<dbSchema.NewEntity, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Entity> => {
  const name =
    data.name ||
    `${faker.word.adjective().toLowerCase()} ${choose(distilleryNames)}}`;

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
  db: AnyDatabase = dbConn,
): Promise<dbSchema.EntityAlias> => {
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(dbSchema.entityAliases)
      .values({
        entityId: data.entityId || (await Entity({}, tx)).id,
        name: choose(distilleryNames),
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
  db: AnyDatabase = dbConn,
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

    const name = data.name ?? chooseBottleName();

    const fullName = formatBottleName({
      ...data,
      name: `${brand.name} ${name}`,
    });

    const bottleData: dbSchema.NewBottle = {
      category: choose([...CATEGORY_LIST, null, null]),
      statedAge: choose([null, null, null, null, 3, 10, 12, 15, 18, 20, 25]),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      name,
      fullName,
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

    Object.assign(
      bottleData,
      normalizeBottle({ ...bottleData, isFullName: false }),
    );

    const [bottle] = await tx
      .insert(bottles)
      .values({
        ...bottleData,
        searchVector,
      })
      .returning();

    if (!bottle) throw new Error("Unable to create Bottle fixture");

    if (distillerIds.length) {
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
  db: AnyDatabase = dbConn,
): Promise<dbSchema.BottleAlias> => {
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(bottleAliases)
      .values({
        bottleId: data.bottleId || (await Bottle({}, tx)).id,
        // TODO: this is using the wrong brand name by default
        name: `${toTitleCase(faker.word.noun())} ${chooseBottleName()}`,
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
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Tasting> => {
  return await db.transaction(async (tx) => {
    const tags = [];
    for (let i = 0; i <= random(1, 5); i++) {
      tags.push((await TagOrExisting({}, tx)).name);
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
  db: AnyDatabase = dbConn,
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
  db: AnyDatabase = dbConn,
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
  db: AnyDatabase = dbConn,
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
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Badge> => {
  const [result] = await db
    .insert(badges)
    .values({
      name: faker.word.noun(),
      tracker: "bottle",
      formula: "default",
      checks: [
        {
          type: "category",
          config: {
            category: ["single_malt"],
          },
        },
      ],
      ...(data as Omit<
        dbSchema.NewBadge,
        "name" | "checks" | "tracker" | "formula"
      >),
    })
    .returning();
  if (!result) throw new Error("Unable to create Badge fixture");
  return result;
};

export const Event = async (
  { ...data }: Partial<Omit<dbSchema.NewEvent, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Event> => {
  const [result] = await db
    .insert(dbSchema.events)
    .values({
      name: faker.music.songName(),
      dateStart: faker.date.future().toISOString(),
      ...(data as Omit<dbSchema.NewEvent, "name" | "dateStart">),
    })
    .returning();
  if (!result) throw new Error("Unable to create Event fixture");
  return result;
};

export const ExternalSiteOrExisting = async (
  { ...data }: Partial<Omit<dbSchema.NewExternalSite, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.ExternalSite> => {
  if (!data.type) data.type = choose(EXTERNAL_SITE_TYPE_LIST);
  const existing = await db.query.externalSites.findFirst({
    where: (externalSites, { eq }) =>
      eq(externalSites.type, data.type as ExternalSiteType),
  });
  if (existing) return existing;

  return await ExternalSite(data, db);
};

export const ExternalSite = async (
  { ...data }: Partial<Omit<dbSchema.NewExternalSite, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.ExternalSite> => {
  if (!data.type) data.type = choose(EXTERNAL_SITE_TYPE_LIST);

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
  db: AnyDatabase = dbConn,
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

    if (!data.externalSiteId)
      data.externalSiteId = (await ExternalSite({}, tx)).id;

    if (!data.volume) data.volume = 750;

    if (!data.currency) data.currency = "usd";

    if (data.hidden === undefined) data.hidden = false;

    if (data.bottleId === undefined) data.bottleId = (await Bottle({}, tx)).id;

    const { rows } = await tx.execute<dbSchema.StorePrice>(
      sql`
        INSERT INTO ${storePrices} (bottle_id, external_site_id, name, volume, price, currency, url, hidden, image_url, updated_at)
        VALUES (${data.bottleId}, ${data.externalSiteId}, ${data.name}, ${data.volume}, ${data.price}, ${data.currency}, ${data.url}, ${data.hidden}, ${data.imageUrl ?? null}, ${data.updatedAt || sql`NOW()`})
        ON CONFLICT (external_site_id, LOWER(name), volume)
        DO UPDATE
        SET bottle_id = COALESCE(excluded.bottle_id, ${storePrices.bottleId}),
            price = excluded.price,
            currency = excluded.currency,
            url = excluded.url,
            updated_at = ${data.updatedAt || sql`NOW()`}
        RETURNING *
      `,
    );

    const [price] = mapRows(rows, storePrices);

    if (!price) throw new Error("Unable to create StorePrice fixture");

    await tx
      .insert(storePriceHistories)
      .values({
        priceId: price.id,
        price: price.price,
        volume: price.volume,
        currency: price.currency,
        date: price.updatedAt.toISOString().substring(0, 10),
      })
      .onConflictDoNothing();

    return price;
  });
};

export const StorePriceHistory = async (
  { ...data }: Partial<Omit<dbSchema.NewStorePriceHistory, "id">> = {},
  db: AnyDatabase = dbConn,
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
  db: AnyDatabase = dbConn,
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
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Collection> => {
  const [result] = await db
    .insert(collections)
    .values({
      name: faker.commerce.product(),
      createdAt: new Date(),
      ...(data as Omit<dbSchema.NewCollection, "name">),
    })
    .returning();
  if (!result) throw new Error("Unable to create Collection fixture");
  return result;
};

export const TagOrExisting = async (
  { ...data }: Partial<Omit<dbSchema.NewTag, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Tag> => {
  if (!data.name) data.name = faker.word.adjective().toLowerCase();

  const existing = await db.query.tags.findFirst({
    where: (tags, { eq }) => eq(tags.name, data.name as string),
  });
  if (existing) return existing;

  return await Tag(data, db);
};

export const Tag = async (
  { ...data }: Partial<Omit<dbSchema.NewTag, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Tag> => {
  if (!data.name) data.name = faker.word.adjective().toLowerCase();

  const [result] = await db
    .insert(dbSchema.tags)
    .values({
      tagCategory: choose(TAG_CATEGORIES),
      flavorProfiles: sample(FLAVOR_PROFILES, random(1, 2)),
      ...(data as Omit<dbSchema.NewTag, "tagCategory" | "flavorProfiles">),
    })
    .returning();
  if (!result) throw new Error("Unable to create Tag fixture");
  return result;
};

export const BadgeAward = async (
  { ...data }: Partial<Omit<dbSchema.NewBadgeAward, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.BadgeAward> => {
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(badgeAwards)
      .values({
        badgeId: data.badgeId || (await Badge({}, tx)).id,
        userId: data.userId || (await User({}, tx)).id,
        xp: data.xp || faker.number.int({ min: 1, max: 1000 }),
        level: data.level || faker.number.int({ min: 1, max: 10 }),
        createdAt: data.createdAt || new Date(),
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create BadgeAward fixture");
  return result;
};

export const AuthToken = async (
  { user }: { user?: dbSchema.User | null } = {},
  db: AnyDatabase = dbConn,
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
  db: AnyDatabase = dbConn,
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

export const BottleRelease = async (
  { ...data }: Partial<Omit<dbSchema.NewBottleRelease, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.BottleRelease> => {
  const [result] = await db.transaction(async (tx) => {
    const bottle = data.bottleId
      ? await tx.query.bottles.findFirst({
          where: (table, { eq }) => eq(table.id, data.bottleId as number),
        })
      : await Bottle({}, tx);

    if (!bottle) throw new Error("Unable to find bottle");

    const bottleBrand = await tx.query.entities.findFirst({
      where: (entities, { eq }) => eq(entities.id, bottle.brandId),
    });
    if (!bottleBrand) throw new Error("Unable to find bottle brand");

    const edition = data.edition ?? choose([null, faker.lorem.word()]);
    const series = data.series ?? choose([null, faker.lorem.word()]);

    const name = `${bottle.name}${edition ? ` ${edition}` : ""}${series ? ` ${series}` : ""}`;
    const fullName =
      data.fullName ||
      formatBottleName({
        ...data,
        name: `${bottleBrand.name} ${name}`,
      });

    const releaseData: dbSchema.NewBottleRelease = {
      ...data,
      bottleId: bottle.id,
      fullName,
      name,
      statedAge: choose([null, null, null, null, 3, 10, 12, 15, 18, 20, 25]),
      abv:
        data.abv ??
        choose([null, null, 40, 43, 46, 48.6, 50, 55.8, 58.9, 63.5]),
      singleCask: data.singleCask ?? choose([null, null, true, false]),
      caskStrength: data.caskStrength ?? choose([null, null, true, false]),
      vintageYear:
        data.vintageYear ??
        choose([
          null,
          null,
          null,
          ...Array.from({ length: 20 }, (_, i) => 1990 + i),
        ]),
      releaseYear:
        data.releaseYear ??
        choose([
          null,
          null,
          null,
          ...Array.from({ length: 20 }, (_, i) => 2000 + i),
        ]),
      caskSize:
        data.caskSize ??
        choose([
          null,
          null,
          "quarter_cask",
          "barrel",
          "hogshead",
          "barrique",
          "puncheon",
          "butt",
          "port_pipe",
          "madeira_drum",
        ]),
      caskType:
        data.caskType ??
        choose([
          null,
          null,
          "bourbon",
          "amontilado",
          "fino",
          "oloroso",
          "pedro_ximenez",
          "madeira",
          "tawny_port",
          "ruby_port",
        ]),
      caskFill:
        data.caskFill ??
        choose([null, null, "1st_fill", "2nd_fill", "refill", "other"]),
      description:
        data.description ?? choose([null, null, faker.lorem.paragraph()]),
      descriptionSrc:
        data.descriptionSrc ?? choose([null, null, "user", "generated"]),
      createdById: data.createdById ?? (await User({}, db)).id,
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
    };

    return await tx
      .insert(dbSchema.bottleReleases)
      .values(releaseData)
      .returning();
  });

  if (!result) throw new Error("Unable to create BottleRelease fixture");

  return result;
};
