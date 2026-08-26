import { faker } from "@faker-js/faker";
import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import type { AnyDatabase, AnyTransaction } from "@peated/server/db";
import { db as dbConn } from "@peated/server/db";
import * as dbSchema from "@peated/server/db/schema";
import {
  actors,
  badgeAwards,
  badges,
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  bottleTags,
  changes,
  collections,
  comments,
  entities,
  externalReviewSourcePolicies,
  externalSites,
  flightBottles,
  flights,
  follows,
  oauthClients,
  passkeys,
  reviewArticles,
  reviews,
  storePriceHistories,
  storePrices,
  tastings,
  toasts,
  users,
} from "@peated/server/db/schema";
import { generateOAuthClientId } from "@peated/server/lib/oauth";
import { generatePublicId } from "@peated/server/lib/publicId";
import slugify from "@sindresorhus/slugify";
import { eq, inArray, or, sql } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import {
  EXTERNAL_SITE_TYPE_LIST,
  FLAVOR_PROFILES,
  TAG_CATEGORIES,
} from "../../constants";
import { getUserActorByIdForDatabase } from "../actors";
import { createAccessToken, generatePasswordHash } from "../auth";
import { materializeBottleForGroup } from "../bottleIdentity";
import { mapRows } from "../db";
import { formatBottleName } from "../format";
import { choose, random, sample } from "../rand";
import {
  buildBottleSearchVector,
  buildBottleSeriesSearchVector,
  buildEntitySearchVector,
} from "../search";
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
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create User fixture");

  await db
    .insert(actors)
    .values({
      type: "user",
      key: String(result.id),
      displayName: result.username,
      userId: result.id,
    })
    .onConflictDoUpdate({
      target: [actors.type, actors.key],
      set: {
        displayName: result.username,
        userId: result.id,
        active: true,
      },
    });

  return result;
};

export const Passkey = async (
  { ...data }: Partial<Omit<dbSchema.NewPasskey, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Passkey> => {
  const [result] = await db
    .insert(passkeys)
    .values({
      userId: data.userId || (await User({}, db)).id,
      credentialId: data.credentialId || `credential_${faker.string.uuid()}`,
      publicKey: data.publicKey || faker.string.alphanumeric(64),
      counter: data.counter ?? 0,
      transports: data.transports || ["internal"],
      nickname: data.nickname || null,
      createdAt: data.createdAt || new Date(),
      lastUsedAt: data.lastUsedAt || null,
    })
    .returning();
  if (!result) throw new Error("Unable to create Passkey fixture");
  return result;
};

export const OAuthClient = async (
  { ...data }: Partial<Omit<dbSchema.NewOAuthClient, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.OAuthClient> => {
  const [result] = await db
    .insert(oauthClients)
    .values({
      clientId: data.clientId ?? generateOAuthClientId(),
      name: data.name ?? faker.company.name(),
      redirectUris: data.redirectUris ?? ["http://127.0.0.1/callback"],
      active: data.active ?? true,
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create OAuth client fixture");
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
  const name = data.name ?? faker.location.country();
  const slug = data.slug ?? slugify(name);
  let [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(dbSchema.countries)
      .values({
        ...data,
        name,
        slug,
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
          eq(sql`LOWER(${dbSchema.countries.name})`, name.toLowerCase()),
          eq(sql`LOWER(${dbSchema.countries.slug})`, slug),
        ),
      );
  }
  if (!result)
    throw new Error(`Unable to create Country fixture: ${name} - ${slug}`);
  return result;
};

export const Region = async (
  { ...data }: Partial<dbSchema.NewRegion> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Region> => {
  const name = data.name ?? faker.location.state();
  let [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(dbSchema.regions)
      .values({
        countryId: data.countryId || (await Country({}, tx)).id,
        ...data,
        name,
        slug: data.slug ?? slugify(name),
      })
      .onConflictDoNothing()
      .returning();
  });
  if (!result) {
    [result] = await db
      .select()
      .from(dbSchema.regions)
      .where(eq(dbSchema.regions.name, name));
  }
  if (!result) throw new Error("Unable to create Region fixture");
  return result;
};

export const EntityOrExisting = async (
  { ...data }: Partial<Omit<dbSchema.NewEntity, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Entity> => {
  const name =
    data.name ??
    `${faker.word.adjective().toLowerCase()} ${choose(distilleryNames)}`;

  const existing = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.name, name),
  });
  if (existing) return existing;

  return await Entity({ ...data, name }, db);
};

export const Entity = async (
  { ...data }: Partial<Omit<dbSchema.NewEntity, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Entity> => {
  const name =
    data.name ||
    `${faker.word.adjective().toLowerCase()} ${choose(distilleryNames)}`;

  return await db.transaction(async (tx) => {
    const createdByActorId =
      data.createdByActorId ??
      (await getUserActorByIdForDatabase(tx, (await User({}, tx)).id)).id;

    const entityData: dbSchema.NewEntity = {
      name,
      countryId: data.countryId ?? (await Country({}, tx)).id,
      type: ["brand", "distiller"],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      createdByActorId,
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
      actorId: entity.createdByActorId,
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

export const EntityEvent = async (
  { ...data }: Partial<Omit<dbSchema.NewEntityEvent, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.EntityEvent> => {
  const entityId = data.entityId ?? (await Entity({}, db)).id;
  const createdByActorId =
    data.createdByActorId ??
    (await getUserActorByIdForDatabase(db, (await User({}, db)).id)).id;
  const [result] = await db
    .insert(dbSchema.entityEvents)
    .values({
      entityId,
      kind: "closed",
      date: "1983",
      ...data,
      createdByActorId,
    })
    .returning();
  if (!result) throw new Error("Unable to create EntityEvent fixture");
  return result;
};

/** Creates a BottleGroup within the caller's transaction. */
const createBottleGroupFixture = async (
  {
    distillerIds = [],
    ...data
  }: Pick<
    dbSchema.NewBottleGroup,
    "fullName" | "name" | "brandId" | "createdByActorId"
  > &
    Partial<
      Omit<
        dbSchema.NewBottleGroup,
        "id" | "fullName" | "name" | "brandId" | "createdByActorId"
      >
    > & {
      distillerIds?: number[];
    },
  db: AnyTransaction,
): Promise<dbSchema.BottleGroup> => {
  const [group] = await db.insert(bottleGroups).values(data).returning();
  if (!group) throw new Error("Unable to create BottleGroup fixture");

  if (distillerIds.length) {
    await db.insert(bottleGroupDistillers).values(
      distillerIds.map((distillerId) => ({
        groupId: group.id,
        distillerId,
      })),
    );
  }

  return group;
};

/** Modern Bottles build a complete graph; legacy fixtures explicitly bypass it. */
type BottleFixtureData = Partial<Omit<dbSchema.NewBottle, "id" | "groupId">> & {
  distillerIds?: number[];
};

type BottleGroupMemberFixtureData = Partial<
  Pick<
    dbSchema.NewBottle,
    | "statedAge"
    | "noAgeStatement"
    | "edition"
    | "abv"
    | "singleCask"
    | "caskStrength"
    | "naturalColor"
    | "nonChillFiltered"
    | "maltPhenolPpm"
    | "vintageYear"
    | "bottlingYear"
    | "releaseYear"
    | "releaseDate"
    | "caskSize"
    | "caskType"
    | "caskFill"
    | "description"
    | "descriptionSrc"
    | "imageUrl"
    | "tastingNotes"
    | "suggestedTags"
    | "avgRating"
    | "ratingStats"
    | "totalTastings"
    | "numReleases"
    | "createdAt"
    | "updatedAt"
    | "createdByActorId"
  >
>;

async function createBottleFixture(
  rawData: BottleFixtureData = {},
  db: AnyDatabase,
  {
    legacy,
    groupId,
  }: {
    legacy: boolean;
    groupId?: number;
  },
): Promise<dbSchema.Bottle> {
  return await db.transaction(async (tx) => {
    const { distillerIds: requestedDistillerIds, ...inputData } = rawData;
    let data = inputData;
    let distillerIds = requestedDistillerIds ?? [];
    let existingGroup: dbSchema.BottleGroup | null = null;

    if (groupId !== undefined) {
      existingGroup =
        (await tx.query.bottleGroups.findFirst({
          where: eq(bottleGroups.id, groupId),
        })) ?? null;
      if (!existingGroup) {
        throw new Error(`BottleGroup fixture does not exist (${groupId})`);
      }

      if (requestedDistillerIds === undefined) {
        distillerIds = (
          await tx
            .select({ distillerId: bottleGroupDistillers.distillerId })
            .from(bottleGroupDistillers)
            .where(eq(bottleGroupDistillers.groupId, groupId))
        ).map(({ distillerId }) => distillerId);
      }

      data = {
        statedAge: existingGroup.statedAge,
        seriesId: existingGroup.seriesId,
        category: existingGroup.category,
        brandId: existingGroup.brandId,
        bottlerId: existingGroup.bottlerId,
        flavorProfile: existingGroup.flavorProfile,
        createdByActorId: existingGroup.createdByActorId,
        ...data,
      };
    }

    const brandId = data.brandId;
    const brand = brandId
      ? await tx.query.entities.findFirst({
          where: (entities, { eq }) => eq(entities.id, brandId),
        })
      : await Entity(
          {
            totalBottles: 1,
          },
          tx,
        );
    if (!brand) throw new Error("Unable to find Bottle brand fixture");

    const baseName = data.name ?? chooseBottleName();
    const materializedGroupFields = existingGroup
      ? materializeBottleForGroup({
          group: existingGroup,
          exact: {
            edition: data.edition ?? null,
            statedAge: data.statedAge ?? null,
            releaseYear: data.releaseYear ?? null,
            vintageYear: data.vintageYear ?? null,
            bottlingYear: data.bottlingYear ?? null,
            abv: data.abv ?? null,
            singleCask: data.singleCask ?? null,
            caskStrength: data.caskStrength ?? null,
            caskType: data.caskType ?? null,
            caskSize: data.caskSize ?? null,
            caskFill: data.caskFill ?? null,
          },
        })
      : null;
    const name = materializedGroupFields?.name ?? baseName;
    const fullName =
      materializedGroupFields?.fullName ??
      formatBottleName({
        ...data,
        name: `${brand.shortName || brand.name} ${baseName}`,
      });

    const createdByActorId =
      data.createdByActorId ??
      (await getUserActorByIdForDatabase(tx, (await User({}, tx)).id)).id;

    const bottleData: dbSchema.NewBottle = {
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      name,
      fullName,
      brandId: brand.id,
      createdByActorId,
      ...materializedGroupFields,
    };

    if (!legacy && !existingGroup) {
      bottleData.groupId = (
        await createBottleGroupFixture(
          {
            fullName,
            name,
            statedAge: bottleData.statedAge,
            seriesId: bottleData.seriesId,
            category: bottleData.category,
            brandId: brand.id,
            bottlerId: bottleData.bottlerId,
            flavorProfile: bottleData.flavorProfile,
            totalBottles: 1,
            createdByActorId,
            distillerIds,
          },
          tx,
        )
      ).id;
    } else if (existingGroup) {
      bottleData.groupId = existingGroup.id;
    }

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

    const series = bottleData.seriesId
      ? await tx.query.bottleSeries.findFirst({
          where: eq(bottleSeries.id, bottleData.seriesId),
        })
      : undefined;

    const searchVector = buildBottleSearchVector(
      bottleData,
      brand,
      [],
      bottler,
      distillerList,
      series,
    );

    // Object.assign(
    //   bottleData,
    //   normalizeBottle({ ...bottleData, isFullName: false }),
    // );

    const [bottle] = await tx
      .insert(bottles)
      .values({
        ...bottleData,
        searchVector,
      })
      .returning();

    if (!bottle) throw new Error("Unable to create Bottle fixture");

    if (!legacy) {
      if (bottle.groupId === null) {
        throw new Error("Modern Bottle fixture has no group");
      }
      await tx
        .update(bottleGroups)
        .set(
          existingGroup
            ? {
                representativeBottleId:
                  existingGroup.representativeBottleId ?? bottle.id,
                totalBottles: sql`${bottleGroups.totalBottles} + 1`,
              }
            : { representativeBottleId: bottle.id },
        )
        .where(eq(bottleGroups.id, bottle.groupId));
    }

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
      assignmentSource: legacy ? "legacy" : "canonical",
      createdAt: bottle.createdAt,
      assignedByActorId: bottle.createdByActorId,
    });

    await tx.insert(changes).values({
      objectId: bottle.id,
      objectType: "bottle",
      displayName: bottle.fullName,
      type: "add",
      createdAt: bottle.createdAt,
      actorId: bottle.createdByActorId,
      data: bottle,
    });

    return bottle;
  });
}

/** Creates a complete singleton BottleGroup and Bottle graph. */
export type GroupedBottleFixture = dbSchema.Bottle & { groupId: number };

export const Bottle = async (
  data: BottleFixtureData = {},
  db: AnyDatabase = dbConn,
): Promise<GroupedBottleFixture> => {
  const bottle = await createBottleFixture(data, db, { legacy: false });
  if (bottle.groupId === null) {
    throw new Error("Grouped Bottle fixture is missing its BottleGroup");
  }
  return { ...bottle, groupId: bottle.groupId };
};

/**
 * Creates a complete Bottle member inside an existing active group for tests
 * that need an already-grouped graph without exercising creation authority.
 */
export const BottleGroupMember = async (
  {
    groupId,
    ...data
  }: BottleGroupMemberFixtureData & {
    groupId: number;
  },
  db: AnyDatabase = dbConn,
): Promise<GroupedBottleFixture> => {
  const bottle = await createBottleFixture(data, db, {
    legacy: false,
    groupId,
  });
  if (bottle.groupId === null) {
    throw new Error("Grouped Bottle fixture is missing its BottleGroup");
  }
  return { ...bottle, groupId: bottle.groupId };
};

/** Creates pre-flattening Bottle data without a group. */
export const LegacyBottle = async (
  data: BottleFixtureData = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Bottle> => {
  return await createBottleFixture(data, db, { legacy: true });
};

async function resolveFixtureBottleId(
  { bottleId }: { bottleId?: number | null },
  _db: AnyDatabase,
): Promise<number | null> {
  if (bottleId !== undefined) return bottleId;
  return (await Bottle({}, _db)).id;
}

export const BottleAlias = async (
  { ...data }: Partial<dbSchema.NewBottleAlias> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.BottleAlias> => {
  const [result] = await db.transaction(async (tx) => {
    const assignedByActorId =
      data.assignedByActorId ??
      (await getUserActorByIdForDatabase(tx, (await User({}, tx)).id)).id;

    const bottleId = await resolveFixtureBottleId(data, tx);

    return await tx
      .insert(bottleAliases)
      .values({
        ...data,
        bottleId,
        // TODO: this is using the wrong brand name by default
        name:
          data.name ??
          `${toTitleCase(faker.word.noun())} ${chooseBottleName()}`,
        createdAt: data.createdAt ?? new Date(),
        assignedByActorId,
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
    const bottleId = await resolveFixtureBottleId(data, tx);
    if (bottleId === null) {
      throw new Error("Tasting fixture requires a Bottle");
    }
    const [result] = await tx
      .insert(tastings)
      .values({
        notes: faker.lorem.sentence(),
        rating: faker.helpers.arrayElement(Object.values(SIMPLE_RATING_VALUES)),
        tags: tags,
        createdAt: new Date(),
        ...data,
        bottleId,
        createdById: data.createdById || (await User({}, tx)).id,
      })
      .returning();

    if (!result) throw new Error("Unable to create Tasting fixture");

    for (const tag of result.bottleId === null ? [] : result.tags) {
      await tx
        .insert(bottleTags)
        .values({
          bottleId: result.bottleId!,
          tag,
          count: 1,
        })
        .onConflictDoUpdate({
          target: [bottleTags.bottleId, bottleTags.tag],
          set: {
            count: sql<string>`${bottleTags.count} + 1`,
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
          bottleId,
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
      ...data,
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
      ...data,
    })
    .returning();
  if (!result) throw new Error("Unable to create Event fixture");
  return result;
};

export const ExternalSiteOrExisting = async (
  { ...data }: Partial<Omit<dbSchema.NewExternalSite, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.ExternalSite> => {
  let type = data.type;
  if (!type) {
    const existing = await db.query.externalSites.findFirst();
    if (existing) return existing;

    type = choose(EXTERNAL_SITE_TYPE_LIST);
  }

  const existing = await db.query.externalSites.findFirst({
    where: (externalSites, { eq }) => eq(externalSites.type, type),
  });
  if (existing) return existing;

  return await ExternalSite({ ...data, type }, db);
};

export const ExternalSite = async (
  { ...data }: Partial<Omit<dbSchema.NewExternalSite, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.ExternalSite> => {
  const type = data.type ?? choose(EXTERNAL_SITE_TYPE_LIST);

  const [result] = await db
    .insert(externalSites)
    .values({
      name: faker.company.name(),
      ...data,
      type,
    })
    .returning();
  if (!result) throw new Error("Unable to create ExternalSite fixture");
  return result;
};

export const ExternalReviewSourcePolicy = async (
  { ...data }: Partial<dbSchema.NewExternalReviewSourcePolicy> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.ExternalReviewSourcePolicy> => {
  const [result] = await db
    .insert(externalReviewSourcePolicies)
    .values({
      externalSiteId:
        data.externalSiteId ?? (await ExternalSiteOrExisting({}, db)).id,
      ...data,
    })
    .returning();
  if (!result) {
    throw new Error("Unable to create ExternalReviewSourcePolicy fixture");
  }
  return result;
};

export const EnabledExternalReviewSourcePolicy = async (
  { ...data }: Partial<dbSchema.NewExternalReviewSourcePolicy> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.ExternalReviewSourcePolicy> => {
  return await ExternalReviewSourcePolicy(
    {
      publicationMode: "review_only",
      allowLlmProcessing: true,
      allowScoreDisplay: true,
      allowSummaryDisplay: true,
      ...data,
    },
    db,
  );
};

export const StorePrice = async (
  { ...data }: Partial<Omit<dbSchema.NewStorePrice, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.StorePrice> => {
  return await db.transaction(async (tx) => {
    const bottleId = await resolveFixtureBottleId(data, tx);

    if (!data.name) {
      const parsedBottleId = z.number().safeParse(bottleId);
      const bottle = parsedBottleId.success
        ? await tx.query.bottles.findFirst({
            where: eq(bottles.id, parsedBottleId.data),
            with: { brand: true },
          })
        : null;
      if (parsedBottleId.success && !bottle) {
        throw new Error(
          `Bottle fixture does not exist (${parsedBottleId.data})`,
        );
      }
      data.name =
        bottle?.fullName ??
        `${toTitleCase(faker.word.noun())} ${chooseBottleName(true)}`;
    }

    if (!data.price)
      data.price =
        parseInt(faker.finance.amount({ min: 50, max: 200, dec: 0 }), 10) * 100;

    if (!data.url) data.url = faker.internet.url();

    if (!data.externalSiteId)
      data.externalSiteId = (await ExternalSiteOrExisting({}, tx)).id;

    if (!data.volume) data.volume = 750;

    if (!data.currency) data.currency = "usd";

    if (data.hidden === undefined) data.hidden = false;

    const values: dbSchema.NewStorePrice = {
      ...data,
      bottleId,
      name: data.name,
      price: data.price,
      url: data.url,
      externalSiteId: data.externalSiteId,
      volume: data.volume,
      currency: data.currency,
      hidden: data.hidden,
    };

    const [price] = await tx.insert(storePrices).values(values).returning();

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

type ReviewFixtureData = Partial<
  Omit<dbSchema.NewReview, "id" | "articleId">
> & {
  articleId?: number;
  externalSiteId?: number;
  issue?: string | null;
  url?: string;
};

export const Review = async (
  {
    externalSiteId: requestedExternalSiteId,
    issue: requestedIssue,
    url: requestedUrl,
    ...data
  }: ReviewFixtureData = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Review> => {
  const [result] = await db.transaction(async (tx) => {
    if (!data.name) {
      const parsedBottleId = z.number().safeParse(data.bottleId);
      const bottle = parsedBottleId.success
        ? await tx.query.bottles.findFirst({
            where: eq(bottles.id, parsedBottleId.data),
            with: { brand: true },
          })
        : data.bottleId === undefined
          ? await Bottle({}, tx)
          : null;
      if (parsedBottleId.success && !bottle) {
        throw new Error(
          `Bottle fixture does not exist (${parsedBottleId.data})`,
        );
      }
      if (data.bottleId === undefined) data.bottleId = bottle?.id;
      data.name =
        bottle?.fullName ??
        `${toTitleCase(faker.word.noun())} ${chooseBottleName(true)}`;
    }

    data.bottleId = await resolveFixtureBottleId(data, tx);

    const externalSiteId =
      requestedExternalSiteId || (await ExternalSiteOrExisting({}, tx)).id;
    const issue = requestedIssue ?? "Default";
    const url = requestedUrl ?? faker.internet.url();
    let articleId = data.articleId;
    let sourceKey = data.sourceKey;
    if (articleId === undefined) {
      const [article] = await tx
        .insert(reviewArticles)
        .values({ externalSiteId, canonicalUrl: url, issue })
        .onConflictDoUpdate({
          target: [reviewArticles.externalSiteId, reviewArticles.canonicalUrl],
          set: { issue },
        })
        .returning({ id: reviewArticles.id });
      if (!article) throw new Error("Unable to create ReviewArticle fixture");
      articleId = article.id;
      if (sourceKey === undefined) sourceKey = url;
    }

    return await tx
      .insert(reviews)
      .values({
        name: "",
        rating: faker.number.int({ min: 59, max: 100 }),
        createdAt: new Date(),
        ...data,
        articleId,
        sourceKey,
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
  const [result] = await db.transaction(async (tx) => {
    return await tx
      .insert(collections)
      .values({
        name: faker.commerce.product(),
        createdAt: new Date(),
        createdById: data.createdById || (await User({}, tx)).id,
        ...data,
      })
      .returning();
  });
  if (!result) throw new Error("Unable to create Collection fixture");
  return result;
};

export const TagOrExisting = async (
  { ...data }: Partial<Omit<dbSchema.NewTag, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Tag> => {
  const name = data.name ?? faker.word.adjective().toLowerCase();

  const existing = await db.query.tags.findFirst({
    where: (tags, { eq }) => eq(tags.name, name),
  });
  if (existing) return existing;

  return await Tag({ ...data, name }, db);
};

export const Tag = async (
  { ...data }: Partial<Omit<dbSchema.NewTag, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.Tag> => {
  const name = data.name ?? faker.word.adjective().toLowerCase();

  const [result] = await db
    .insert(dbSchema.tags)
    .values({
      tagCategory: choose(TAG_CATEGORIES),
      flavorProfiles: sample(FLAVOR_PROFILES, random(1, 2)),
      ...data,
      name,
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
  return new File(
    [await readFile(await SampleSquareImagePath())],
    "sample-square-image.jpg",
    { type: "image/jpeg" },
  );
};

export const SampleSquareImagePath = async () => {
  return path.join(__dirname, "assets", "sample-square-image.jpg");
};

export async function BottleSeries(
  { ...data }: Partial<Omit<dbSchema.NewBottleSeries, "id">> = {},
  db: AnyDatabase = dbConn,
): Promise<dbSchema.BottleSeries> {
  const result = await db.transaction(async (tx) => {
    const brandId =
      data.brandId ?? (await Entity({ type: ["distiller"] }, tx)).id;

    // Get the brand to build fullName
    const brand = await tx.query.entities.findFirst({
      where: (entities, { eq }) => eq(entities.id, brandId),
    });
    if (!brand) throw new Error("Unable to find brand");

    const name = data.name ?? faker.commerce.productName();
    const fullName = `${brand.shortName || brand.name} ${name}`;

    const values = {
      name,
      fullName,
      description: data.description ?? faker.lorem.sentence(),
      brandId,
      createdByActorId:
        data.createdByActorId ??
        (await getUserActorByIdForDatabase(tx, (await User({}, tx)).id)).id,
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
      numReleases: data.numReleases ?? 0,
    };

    const result = await tx
      .insert(bottleSeries)
      .values({
        ...values,
        searchVector: buildBottleSeriesSearchVector(values, brand),
      })
      .returning();

    return result[0];
  });

  if (!result) throw new Error("Unable to create BottleSeries fixture");

  return result;
}
