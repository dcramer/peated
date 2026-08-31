import { normalizeEntityName } from "@peated/bottle-classifier/normalize";
import { type CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import type { InferSelectModel, Table } from "drizzle-orm";
import { and, eq, getTableColumns, inArray, ne, or, sql } from "drizzle-orm";
import type { PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { ReservedCollectionSlug } from "../constants";
import type { AnyDatabase } from "../db";
import type { Collection, Entity, EntityKind } from "../db/schema";
import { changes, collections, entities, entityReferences } from "../db/schema";
import {
  EntityInputSchema,
  EntityKindEnum,
  type EntitySchema,
} from "../schemas";
import { getCatalogVerificationCreationMetadata } from "./catalogVerification";

export type UpsertOutcome<T> =
  | {
      id: number;
      result: T;
      created: boolean;
      changed: boolean;
    }
  | undefined;

const EntityUpsertDataSchema = EntityInputSchema.omit({
  country: true,
  kind: true,
  region: true,
}).extend({
  id: z.number().nullish(),
  kind: EntityKindEnum.optional(),
  countryId: z.number().nullish(),
  regionId: z.number().nullish(),
});
const EntityInsertDataSchema = EntityUpsertDataSchema.omit({
  id: true,
}).required({ kind: true });
type EntityUpsertData = z.input<typeof EntityUpsertDataSchema>;
type EntityUpsertInput = number | EntityUpsertData;

export type ReservedCollection = Pick<
  Collection,
  "id" | "createdById" | "name"
>;

export const RESERVED_COLLECTIONS = {
  // `default` is the historical API token for the user-facing Favorites list.
  default: {
    name: "Default",
  },
  library: {
    name: "Library",
  },
} satisfies Record<
  ReservedCollectionSlug,
  {
    name: string;
  }
>;

export function isReservedCollectionSlug(
  value: ReservedCollectionSlug | number,
): value is ReservedCollectionSlug {
  return value === "default" || value === "library";
}

export function coerceToUpsert({
  country,
  region,
  ...data
}: EntityUpsertData & {
  country?: number | { id: number } | null;
  region?: number | { id: number } | null;
}): EntityUpsertData {
  const rv: EntityUpsertData = { ...data };
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

export class EntityReferenceConflictError extends Error {
  constructor(
    readonly entityId: number,
    readonly referenceName: string,
  ) {
    super(`The name "${referenceName}" belongs to Entity ${entityId}.`);
    this.name = "EntityReferenceConflictError";
  }
}

export function requiredEntityReferenceNames({
  name,
  shortName,
}: {
  name: string;
  shortName?: string | null;
}) {
  const seen = new Set<string>();
  return [
    name,
    shortName,
    name.startsWith("The ") ? name.substring(4) : null,
  ].filter((value): value is string => {
    if (!value || seen.has(value.toLowerCase())) return false;
    seen.add(value.toLowerCase());
    return true;
  });
}

/** Finds an Entity only when the name is accepted for automatic matching. */
export async function findEntityByExactNameOrReference(
  db: AnyDatabase,
  name: string,
): Promise<Entity | null> {
  const normalizedName = normalizeEntityName(name).trim();
  if (!normalizedName) {
    return null;
  }

  const lowerName = normalizedName.toLowerCase();

  const [row] = await db
    .select({ entity: entities })
    .from(entities)
    .leftJoin(entityReferences, eq(entityReferences.entityId, entities.id))
    .where(
      or(
        eq(sql`LOWER(${entities.name})`, lowerName),
        eq(sql`LOWER(COALESCE(${entities.shortName}, ''))`, lowerName),
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
        eq(sql`LOWER(${entityReferences.name})`, lowerName),
      ),
    )
    .limit(1);

  return row?.entity ?? null;
}

/** Keeps the names used for automatic matching in sync with the Entity. */
export async function upsertEntityReferences({
  db,
  entity,
  previousEntity = null,
}: {
  db: AnyDatabase;
  entity: Pick<Entity, "id" | "name" | "shortName" | "createdAt">;
  previousEntity?: Pick<Entity, "name" | "shortName"> | null;
}) {
  const nextReferenceNames = requiredEntityReferenceNames(entity);
  const nextReferenceNamesLower = new Set(
    nextReferenceNames.map((referenceName) => referenceName.toLowerCase()),
  );

  for (const referenceName of nextReferenceNames) {
    const existingReference = await db.query.entityReferences.findFirst({
      where: eq(
        sql`LOWER(${entityReferences.name})`,
        referenceName.toLowerCase(),
      ),
    });

    if (existingReference?.entityId === entity.id) {
      if (existingReference.name !== referenceName) {
        await db
          .update(entityReferences)
          .set({ name: referenceName })
          .where(
            eq(
              sql`LOWER(${entityReferences.name})`,
              existingReference.name.toLowerCase(),
            ),
          );
      }
      continue;
    }

    if (!existingReference) {
      await db.insert(entityReferences).values({
        name: referenceName,
        entityId: entity.id,
        createdAt: entity.createdAt,
      });
      continue;
    }

    if (!existingReference.entityId) {
      await db
        .update(entityReferences)
        .set({ entityId: entity.id })
        .where(
          eq(
            sql`LOWER(${entityReferences.name})`,
            existingReference.name.toLowerCase(),
          ),
        );
      continue;
    }

    throw new EntityReferenceConflictError(
      existingReference.entityId,
      referenceName,
    );
  }

  if (!previousEntity) {
    return;
  }

  const retiredReferenceNames = requiredEntityReferenceNames(
    previousEntity,
  ).filter(
    (referenceName) =>
      !nextReferenceNamesLower.has(referenceName.toLowerCase()),
  );
  if (!retiredReferenceNames.length) {
    return;
  }

  await db.delete(entityReferences).where(
    and(
      eq(entityReferences.entityId, entity.id),
      inArray(
        sql`LOWER(${entityReferences.name})`,
        retiredReferenceNames.map((referenceName) =>
          referenceName.toLowerCase(),
        ),
      ),
    ),
  );
}

export const upsertEntity = async ({
  db,
  data,
  createdByActorId,
  kind,
  creationSource,
}: {
  db: AnyDatabase;
  data: EntityUpsertInput;
  createdByActorId: number;
  // The caller owns the creation context. Existing Entities keep their stored kind.
  kind: EntityKind;
  creationSource?: CatalogVerificationCreationSource;
}): Promise<UpsertOutcome<Entity>> => {
  if (!data) return undefined;

  const numericData = z.number().safeParse(data);
  if (numericData.success) {
    const result = await db.query.entities.findFirst({
      where: (entities, { eq }) => eq(entities.id, numericData.data),
    });

    if (!result) {
      return undefined;
    }

    return {
      id: result.id,
      result,
      created: false,
      changed: false,
    };
  }

  const entityData = EntityUpsertDataSchema.parse(data);
  if (entityData.id) {
    const entityId = Number(entityData.id);
    const result = await db.query.entities.findFirst({
      where: (entities, { eq }) => eq(entities.id, entityId),
    });

    if (!result) {
      return undefined;
    }

    return {
      id: result.id,
      result,
      created: false,
      changed: false,
    };
  }

  const normalizedData = EntityInsertDataSchema.parse({
    ...entityData,
    kind: entityData.kind ?? kind,
    name: normalizeEntityName(entityData.name),
  });
  const actorId = createdByActorId;

  const existingEntity = await findEntityByExactNameOrReference(
    db,
    normalizedData.name,
  );
  if (existingEntity) {
    return {
      id: existingEntity.id,
      result: existingEntity,
      created: false,
      changed: false,
    };
  }

  const [result] = await db
    .insert(entities)
    .values({
      ...normalizedData,
      createdByActorId: actorId,
    })
    .onConflictDoNothing()
    .returning();

  if (result) {
    const changeData: typeof result & {
      catalogVerification?: ReturnType<
        typeof getCatalogVerificationCreationMetadata
      >;
    } = { ...result };
    if (creationSource) {
      changeData.catalogVerification =
        getCatalogVerificationCreationMetadata(creationSource);
    }
    await db.insert(changes).values({
      objectType: "entity",
      objectId: result.id,
      displayName: result.name,
      type: "add",
      data: changeData,
      actorId,
      createdAt: result.createdAt,
    });

    await upsertEntityReferences({
      db,
      entity: result,
    });

    return {
      id: result.id,
      result,
      created: true,
      changed: true,
    };
  }

  const resultConflict = await findEntityByExactNameOrReference(
    db,
    normalizedData.name,
  );

  if (resultConflict) {
    return {
      id: resultConflict.id,
      result: resultConflict,
      created: false,
      changed: false,
    };
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

export function mapRows<T extends TableConfig, Row extends object>(
  rows: Row[],
  table: PgTableWithColumns<T>,
): InferSelectModel<Table<T>>[] {
  const cols = Object.fromEntries(
    Object.entries(getTableColumns(table)).map(([attr, col]) => [
      col.name,
      { col, attr },
    ]),
  );

  // SAFETY: Table metadata owns the column-to-property mapping and value conversion.
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
  ) as InferSelectModel<Table<T>>[];
}
