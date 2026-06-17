import { normalizeEntityName } from "@peated/bottle-classifier/normalize";
import { type CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import type { InferSelectModel, Table } from "drizzle-orm";
import { and, eq, getTableColumns, inArray, ne, sql } from "drizzle-orm";
import type { PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";
import { type z } from "zod";
import type { AnyDatabase } from "../db";
import type {
  BottleAlias,
  BottleAliasAssignmentSource,
  Collection,
  Entity,
  EntityType,
} from "../db/schema";
import {
  bottleAliases,
  changes,
  collections,
  entities,
  entityAliases,
} from "../db/schema";
import { type EntityInputSchema, type EntitySchema } from "../schemas";
import { type EntityInput } from "../types";
import { getCatalogVerificationCreationMetadata } from "./catalogVerification";

export type UpsertOutcome<T> =
  | {
      id: number;
      result: T;
      created: boolean;
    }
  | undefined;

export const reservedCollectionSlugs = ["default", "library"] as const;

export type ReservedCollectionSlug = (typeof reservedCollectionSlugs)[number];
export type ReservedCollection = Pick<Collection, "id" | "createdById">;

export const RESERVED_COLLECTIONS: Record<
  ReservedCollectionSlug,
  {
    name: string;
  }
> = {
  // `default` is the historical API token for the user-facing Favorites list.
  default: {
    name: "Default",
  },
  library: {
    name: "Library",
  },
};

export function isReservedCollectionSlug(
  value: unknown,
): value is ReservedCollectionSlug {
  return reservedCollectionSlugs.includes(value as ReservedCollectionSlug);
}

export function coerceToUpsert({
  country,
  region,
  ...data
}:
  | z.infer<typeof EntityInputSchema>
  | z.infer<typeof EntitySchema>): EntityInput {
  const rv: EntityInput = { ...data };
  if (country instanceof Object) {
    rv.countryId = country.id;
  } else if (country) {
    rv.countryId = country;
  }
  if (region instanceof Object) {
    rv.regionId = region.id;
  } else if (region) {
    rv.regionId = region;
  }
  return rv;
}

function getEntityAliasNames({
  name,
  shortName,
}: {
  name: string;
  shortName?: string | null;
}) {
  return Array.from(
    new Set(
      [
        name,
        shortName,
        name.startsWith("The ") ? name.substring(4) : null,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

/**
 * Bottle creation accepts entity ids or lightweight draft objects. When a draft
 * name is already known as an exact canonical name, short name, or alias, we
 * should reuse that entity instead of minting a duplicate brand/bottler.
 */
export async function findEntityByExactNameOrAlias(
  db: AnyDatabase,
  name: string,
): Promise<Entity | null> {
  const normalizedName = normalizeEntityName(name).trim();
  if (!normalizedName) {
    return null;
  }

  const lowerName = normalizedName.toLowerCase();

  const [entityByName] = await db
    .select()
    .from(entities)
    .where(eq(sql`LOWER(${entities.name})`, lowerName))
    .limit(1);
  if (entityByName) {
    return entityByName;
  }

  const [entityByShortName] = await db
    .select()
    .from(entities)
    .where(eq(sql`LOWER(COALESCE(${entities.shortName}, ''))`, lowerName))
    .limit(1);
  if (entityByShortName) {
    return entityByShortName;
  }

  const [entityByTrimmedArticle] = await db
    .select()
    .from(entities)
    .where(
      eq(
        sql`LOWER(
          CASE
            WHEN ${entities.name} ILIKE 'The %'
              THEN SUBSTRING(${entities.name} FROM 5)
              ELSE ''
          END
        )`,
        lowerName,
      ),
    )
    .limit(1);
  if (entityByTrimmedArticle) {
    return entityByTrimmedArticle;
  }

  const [entityByAlias] = await db
    .select({ entity: entities })
    .from(entityAliases)
    .innerJoin(entities, eq(entityAliases.entityId, entities.id))
    .where(eq(sql`LOWER(${entityAliases.name})`, lowerName))
    .limit(1);

  return entityByAlias?.entity ?? null;
}

async function mergeEntityTypeIfNeeded({
  db,
  entity,
  type,
}: {
  db: AnyDatabase;
  entity: Entity;
  type?: EntityType;
}): Promise<Entity> {
  if (!type || entity.type.includes(type)) {
    return entity;
  }

  const [updatedEntity] = await db
    .update(entities)
    .set({ type: [...entity.type, type] })
    .where(eq(entities.id, entity.id))
    .returning();

  return updatedEntity ?? { ...entity, type: [...entity.type, type] };
}

/**
 * Keep entity aliases in sync anywhere we can create or rename entities.
 * Exact short-name and alias matching is one of the cheap deterministic paths
 * that lets ingestion bypass the classifier safely when the identity is known.
 */
export async function upsertEntityAliases({
  db,
  entity,
  previousEntity = null,
}: {
  db: AnyDatabase;
  entity: Pick<Entity, "id" | "name" | "shortName" | "createdAt">;
  previousEntity?: Pick<Entity, "name" | "shortName"> | null;
}) {
  const nextAliasNames = getEntityAliasNames(entity);
  const nextAliasNamesLower = new Set(
    nextAliasNames.map((aliasName) => aliasName.toLowerCase()),
  );

  for (const aliasName of nextAliasNames) {
    const existingAlias = await db.query.entityAliases.findFirst({
      where: eq(sql`LOWER(${entityAliases.name})`, aliasName.toLowerCase()),
    });

    if (existingAlias?.entityId === entity.id) {
      if (existingAlias.name !== aliasName) {
        await db
          .update(entityAliases)
          .set({ name: aliasName })
          .where(
            eq(
              sql`LOWER(${entityAliases.name})`,
              existingAlias.name.toLowerCase(),
            ),
          );
      }
      continue;
    }

    if (!existingAlias) {
      await db.insert(entityAliases).values({
        name: aliasName,
        entityId: entity.id,
        createdAt: entity.createdAt,
      });
      continue;
    }

    if (!existingAlias.entityId) {
      await db
        .update(entityAliases)
        .set({ entityId: entity.id })
        .where(
          eq(
            sql`LOWER(${entityAliases.name})`,
            existingAlias.name.toLowerCase(),
          ),
        );
      continue;
    }

    throw new Error(
      `Duplicate entity alias found (${existingAlias.entityId}) for "${aliasName}".`,
    );
  }

  if (!previousEntity) {
    return;
  }

  const retiredAliasNames = getEntityAliasNames(previousEntity).filter(
    (aliasName) => !nextAliasNamesLower.has(aliasName.toLowerCase()),
  );
  if (!retiredAliasNames.length) {
    return;
  }

  await db.delete(entityAliases).where(
    and(
      eq(entityAliases.entityId, entity.id),
      inArray(
        sql`LOWER(${entityAliases.name})`,
        retiredAliasNames.map((aliasName) => aliasName.toLowerCase()),
      ),
    ),
  );
}

export const upsertEntity = async ({
  db,
  data,
  userId,
  type,
  creationSource,
}: {
  db: AnyDatabase;
  data: EntityInput;
  userId: number;
  type?: EntityType;
  creationSource?: CatalogVerificationCreationSource;
}): Promise<UpsertOutcome<Entity>> => {
  if (!data) return undefined;

  if (typeof data === "number" || data.id) {
    const entityId = typeof data === "number" ? data : Number(data.id);
    const result = await db.query.entities.findFirst({
      where: (entities, { eq }) => eq(entities.id, entityId),
    });

    if (!result) {
      return undefined;
    }

    const mergedResult = await mergeEntityTypeIfNeeded({
      db,
      entity: result,
      type,
    });
    return { id: mergedResult.id, result: mergedResult, created: false };
  } else if (data.id === null) {
    data.id = undefined;
  }

  data = {
    ...data,
    name: normalizeEntityName(data.name),
  };

  const existingEntity = await findEntityByExactNameOrAlias(db, data.name);
  if (existingEntity) {
    const mergedEntity = await mergeEntityTypeIfNeeded({
      db,
      entity: existingEntity,
      type,
    });
    return { id: mergedEntity.id, result: mergedEntity, created: false };
  }

  const [result] = await db
    .insert(entities)
    .values({
      ...data,
      type: Array.from(
        new Set([...(type ? [type] : []), ...(data.type || [])]),
      ),
      createdById: userId,
    })
    .onConflictDoNothing()
    .returning();

  if (result) {
    await db.insert(changes).values({
      objectType: "entity",
      objectId: result.id,
      displayName: result.name,
      type: "add",
      data: {
        ...result,
        ...(creationSource
          ? {
              catalogVerification:
                getCatalogVerificationCreationMetadata(creationSource),
            }
          : {}),
      },
      createdById: userId,
      createdAt: result.createdAt,
    });

    await upsertEntityAliases({
      db,
      entity: result,
    });

    return { id: result.id, result, created: true };
  }

  const resultConflict = await findEntityByExactNameOrAlias(db, data.name);

  if (resultConflict) {
    const mergedEntity = await mergeEntityTypeIfNeeded({
      db,
      entity: resultConflict,
      type,
    });
    return { id: mergedEntity.id, result: mergedEntity, created: false };
  }
  throw new Error("We should never hit this case in upsert");
};

/**
 * Resolve a reserved saved-bottle collection alias for a user. Writes can opt
 * into creation; reads stay lookup-only. The historical `default` alias keeps a
 * compatibility fallback to the user's earliest non-Library collection.
 */
export const getReservedCollection = async (
  db: AnyDatabase,
  userId: number,
  slug: ReservedCollectionSlug,
  { create = false }: { create?: boolean } = {},
): Promise<ReservedCollection | null> => {
  const collectionConfig = RESERVED_COLLECTIONS[slug];
  const collection =
    (await db.query.collections.findFirst({
      where: (collections, { and, eq }) =>
        and(
          eq(collections.createdById, userId),
          sql`LOWER(${collections.name}) = ${collectionConfig.name.toLowerCase()}`,
        ),
    })) || null;

  if (collection || !create) {
    return (
      collection ||
      (slug === "default" ? await getLegacyDefaultCollection(db, userId) : null)
    );
  }

  const legacyDefault =
    slug === "default" ? await getLegacyDefaultCollection(db, userId) : null;
  if (legacyDefault) {
    return legacyDefault;
  }

  return (
    (
      await db
        .insert(collections)
        .values({
          name: collectionConfig.name,
          createdById: userId,
        })
        .onConflictDoNothing()
        .returning()
    ).find(() => true) ||
    (await db.query.collections.findFirst({
      where: (collections, { eq }) =>
        and(
          eq(collections.createdById, userId),
          sql`LOWER(${collections.name}) = ${collectionConfig.name.toLowerCase()}`,
        ),
    })) ||
    null
  );
};

export const getDefaultCollection = async (
  db: AnyDatabase,
  userId: number,
): Promise<ReservedCollection | null> =>
  getReservedCollection(db, userId, "default", { create: true });

async function getLegacyDefaultCollection(
  db: AnyDatabase,
  userId: number,
): Promise<ReservedCollection | null> {
  // Preserve the historical `default` behavior for users whose earliest
  // non-Library collection predates the reserved backing name.
  return (
    (await db.query.collections.findFirst({
      where: (collections, { and, eq }) =>
        and(
          eq(collections.createdById, userId),
          ne(
            sql`LOWER(${collections.name})`,
            RESERVED_COLLECTIONS.library.name.toLowerCase(),
          ),
        ),
      orderBy: (collections, { asc }) => asc(collections.id),
    })) || null
  );
}

/**
 * Upserts a bottle alias without stealing an existing target. Targeted aliases
 * default to legacy assertions unless explicit provenance is supplied.
 */
export async function upsertBottleAlias(
  db: AnyDatabase,
  name: string,
  bottleId: number | null = null,
  releaseId: number | null = null,
  options: {
    assignmentSource?: BottleAliasAssignmentSource;
    assignedById?: number | null;
  } = {},
) {
  const { assignmentSource, assignedById } = options;
  const hasExplicitAssignmentOptions =
    assignmentSource !== undefined || "assignedById" in options;
  const nextAssignmentSource = assignmentSource ?? "legacy";
  const nextAssignedById = assignedById ?? null;

  // Preserve existing targets on conflicts. Explicit provenance may update an
  // already-bound alias only when the incoming target is the same target.
  const query =
    bottleId || releaseId
      ? await db.execute<BottleAlias>(
          sql`INSERT INTO ${bottleAliases} (bottle_id, release_id, name, assignment_source, assigned_by_id)
      VALUES (${bottleId}, ${releaseId}, ${name}, ${nextAssignmentSource}, ${nextAssignedById})
      ON CONFLICT (LOWER(name))
      DO UPDATE SET
        bottle_id = CASE
          WHEN ${bottleAliases.bottleId} IS NULL
            THEN EXCLUDED.bottle_id
            ELSE ${bottleAliases.bottleId}
          END,
        release_id = CASE
          WHEN ${bottleAliases.releaseId} IS NULL
            THEN EXCLUDED.release_id
            ELSE ${bottleAliases.releaseId}
          END,
        assignment_source = CASE
          WHEN ${bottleAliases.bottleId} IS NULL OR (
            ${hasExplicitAssignmentOptions}
            AND ${bottleAliases.bottleId} IS NOT DISTINCT FROM EXCLUDED.bottle_id
            AND (
              ${bottleAliases.releaseId} IS NULL
              OR ${bottleAliases.releaseId} IS NOT DISTINCT FROM EXCLUDED.release_id
            )
          )
            THEN EXCLUDED.assignment_source
            ELSE ${bottleAliases.assignmentSource}
          END,
        assigned_by_id = CASE
          WHEN ${bottleAliases.bottleId} IS NULL OR (
            ${hasExplicitAssignmentOptions}
            AND ${bottleAliases.bottleId} IS NOT DISTINCT FROM EXCLUDED.bottle_id
            AND (
              ${bottleAliases.releaseId} IS NULL
              OR ${bottleAliases.releaseId} IS NOT DISTINCT FROM EXCLUDED.release_id
            )
          )
            THEN EXCLUDED.assigned_by_id
            ELSE ${bottleAliases.assignedById}
          END
      RETURNING *`,
        )
      : await db.execute<BottleAlias>(
          sql`INSERT INTO ${bottleAliases} (bottle_id, release_id, name, assignment_source, assigned_by_id)
      VALUES (${bottleId}, ${releaseId}, ${name}, ${nextAssignmentSource}, ${nextAssignedById})
      ON CONFLICT (LOWER(name))
      DO UPDATE SET name = ${bottleAliases.name}
      RETURNING *`,
        );

  return mapRows(query.rows, bottleAliases)[0];
}

export function mapRows<T extends TableConfig>(
  rows: Record<string, unknown>[],
  table: PgTableWithColumns<T>,
): InferSelectModel<Table<T>>[] {
  const cols = Object.fromEntries(
    Object.entries(getTableColumns(table)).map(([attr, col]) => [
      col.name,
      { col, attr },
    ]),
  );

  return rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => {
        const r = cols[k];
        return [
          r ? r.attr : k,
          r ? (v !== null ? r.col.mapFromDriverValue(v) : v) : v,
        ];
      }),
    ),
  ) as unknown as InferSelectModel<Table<T>>[];
}
