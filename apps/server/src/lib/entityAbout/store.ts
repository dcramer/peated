import type { AnyDatabase } from "@peated/server/db";
import {
  changes,
  entities,
  entityAbout,
  entityTombstones,
  type Actor,
  type EntityKind,
} from "@peated/server/db/schema";
import {
  ENTITY_ABOUT_SCHEMA_VERSION,
  EntityAboutDocumentSchema,
  type AboutLinkedEntity,
  type EntityAboutDocument,
  type EntityAboutStatus,
} from "@peated/server/schemas/entityAbout";
import { and, eq, inArray, sql } from "drizzle-orm";

import {
  ABOUT_FACT_FIELD_LIST,
  aboutFactFieldAppliesTo,
} from "./aboutFactFields";
import { findAboutWriteErrors } from "./document";

function unsupportedSchemaVersion(version: number): never {
  throw new Error(`Unsupported About schema version: ${version}`);
}

export type StoredEntityAbout = {
  entityId: number;
  document: EntityAboutDocument;
  version: number;
  status: EntityAboutStatus;
  checkedOn: string | null;
};

export class EntityAboutWriteError extends Error {
  constructor(
    message: string,
    readonly reasons: string[],
  ) {
    super(message);
  }
}

export class EntityAboutVersionError extends Error {}

export async function getEntityAbout(
  database: AnyDatabase,
  entityId: number,
  { forUpdate = false }: { forUpdate?: boolean } = {},
): Promise<StoredEntityAbout | null> {
  const query = database
    .select()
    .from(entityAbout)
    .where(eq(entityAbout.entityId, entityId))
    .limit(1);
  const [row] = forUpdate ? await query.for("update") : await query;
  return row ? toStoredEntityAbout(row) : null;
}

/** Parses a stored `entity_about` row. */
export function toStoredEntityAbout(
  row: typeof entityAbout.$inferSelect,
): StoredEntityAbout {
  return {
    entityId: row.entityId,
    // About schema rule: version 1 is the only stored shape. A breaking
    // change adds its upgrade here, before parsing.
    document:
      row.schemaVersion === ENTITY_ABOUT_SCHEMA_VERSION
        ? EntityAboutDocumentSchema.parse(row.document)
        : unsupportedSchemaVersion(row.schemaVersion),
    version: row.version,
    status: row.status,
    checkedOn: row.checkedOn,
  };
}

/**
 * Maps each Entity ID to the Entity it now is. Merge rule (owner:
 * `mergeEntity`): a merge leaves About pages alone, and reads follow the
 * merged Entity's tombstone instead.
 */
export async function followMergedEntities(
  database: AnyDatabase,
  ids: readonly number[],
) {
  const target = new Map<number, number>(ids.map((id) => [id, id]));
  // Merges chain (A into B, then B into C), so each hop is followed to the
  // end. The limit stops a tombstone cycle.
  let pending = [...new Set(ids)];
  for (let hop = 0; pending.length && hop < MAX_MERGE_HOPS; hop += 1) {
    const tombstones = await database
      .select()
      .from(entityTombstones)
      .where(inArray(entityTombstones.entityId, pending));
    const next = new Map<number, number>();
    for (const tombstone of tombstones) {
      if (tombstone.newEntityId) {
        next.set(tombstone.entityId, tombstone.newEntityId);
      }
    }
    for (const [id, current] of target) {
      const moved = next.get(current);
      if (moved) target.set(id, moved);
    }
    pending = [...new Set(next.values())];
  }
  return target;
}

const MAX_MERGE_HOPS = 10;

/**
 * Loads the Entities the documents link, following merged Entities to the
 * one they became. Every public read of a page uses it, so the tab, the page,
 * and the description agree on what shows.
 */
export async function loadLinkedEntities(
  database: AnyDatabase,
  documents: readonly EntityAboutDocument[],
) {
  const linked = new Map<number, AboutLinkedEntity>();
  const ids = [
    ...new Set(
      documents.flatMap((document) =>
        document.events.flatMap((event) =>
          [event.relatedEntityId, event.newOwnerId].filter((id) => id !== null),
        ),
      ),
    ),
  ];
  if (!ids.length) return linked;

  const target = await followMergedEntities(database, ids);
  const rows = await database
    .select({ id: entities.id, name: entities.name, kind: entities.kind })
    .from(entities)
    .where(inArray(entities.id, [...new Set(target.values())]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const [id, targetId] of target) {
    const row = byId.get(targetId);
    if (row) linked.set(id, row);
  }
  return linked;
}

/**
 * The only write path for About documents. Run it inside a transaction: it
 * locks the row, rejects a stale `expectedVersion`, checks the document, and
 * saves the full document to change history.
 */
export async function saveEntityAbout(
  tx: AnyDatabase,
  {
    entity,
    document,
    expectedVersion,
    actor,
    checkedOn,
  }: {
    entity: { id: number; name: string; kind: EntityKind };
    document: EntityAboutDocument;
    expectedVersion: number | null;
    actor: Actor;
    checkedOn?: string | null;
  },
): Promise<StoredEntityAbout> {
  const stored = await getEntityAbout(tx, entity.id, { forUpdate: true });
  if ((stored?.version ?? null) !== expectedVersion) {
    throw new EntityAboutVersionError(
      `About for entity ${entity.id} changed since it was read.`,
    );
  }

  // Every saved document must parse on read (owner: the schema rule in
  // schemas/entityAbout.ts), so it is parsed before it is written.
  const parsed = EntityAboutDocumentSchema.safeParse(document);
  if (!parsed.success) {
    throw new EntityAboutWriteError(
      "The About document is not valid.",
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    );
  }
  const reasons = findAboutWriteErrors(document);
  for (const field of ABOUT_FACT_FIELD_LIST) {
    if (
      document.siteFacts[field] &&
      !aboutFactFieldAppliesTo(field, entity.kind)
    ) {
      reasons.push(`Site fact ${field} does not apply to a ${entity.kind}.`);
    }
  }
  if (reasons.length) {
    throw new EntityAboutWriteError(
      "The About document is not valid.",
      reasons,
    );
  }

  const version = (stored?.version ?? 0) + 1;
  const nextCheckedOn =
    checkedOn === undefined ? (stored?.checkedOn ?? null) : checkedOn;
  // A first save can race another first save; the loser gets a version
  // error instead of overwriting.
  const [written] = stored
    ? await tx
        .update(entityAbout)
        .set({
          document,
          schemaVersion: ENTITY_ABOUT_SCHEMA_VERSION,
          version,
          checkedOn: nextCheckedOn,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(entityAbout.entityId, entity.id),
            eq(entityAbout.version, stored.version),
          ),
        )
        .returning({ entityId: entityAbout.entityId })
    : await tx
        .insert(entityAbout)
        .values({
          entityId: entity.id,
          document,
          schemaVersion: ENTITY_ABOUT_SCHEMA_VERSION,
          version,
          checkedOn: nextCheckedOn,
        })
        .onConflictDoNothing()
        .returning({ entityId: entityAbout.entityId });
  if (!written) {
    throw new EntityAboutVersionError(
      `About for entity ${entity.id} changed since it was read.`,
    );
  }

  await tx.insert(changes).values({
    objectType: "entity_about",
    objectId: entity.id,
    displayName: entity.name,
    actorId: actor.id,
    type: stored ? "update" : "add",
    data: { version, document },
  });

  return {
    entityId: entity.id,
    document,
    version,
    status: stored?.status ?? "published",
    checkedOn: nextCheckedOn,
  };
}

export async function setEntityAboutStatus(
  tx: AnyDatabase,
  {
    entity,
    status,
    actor,
  }: {
    entity: { id: number; name: string };
    status: EntityAboutStatus;
    actor: Actor;
  },
) {
  const [row] = await tx
    .update(entityAbout)
    .set({ status, updatedAt: sql`now()` })
    .where(eq(entityAbout.entityId, entity.id))
    .returning({ version: entityAbout.version });
  if (!row) return false;
  await tx.insert(changes).values({
    objectType: "entity_about",
    objectId: entity.id,
    displayName: entity.name,
    actorId: actor.id,
    type: "update",
    data: { status },
  });
  return true;
}
