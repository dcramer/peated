import { db } from "@peated/server/db";
import { actors, entities, entityEvents } from "@peated/server/db/schema";
import { getPeatedSystemActorForDatabase } from "@peated/server/lib/actors";
import {
  mergeEntityAboutDocuments,
  normalizeSourceUrl,
} from "@peated/server/lib/entityAbout/document";
import {
  getEntityAbout,
  saveEntityAbout,
} from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import type {
  AboutSource,
  EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";
import { asc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";

type LegacyRow = typeof entityEvents.$inferSelect & { actorType: string };

/** Builds an About document from one Entity's `entity_event` rows. */
function buildDocumentFromLegacyEvents(
  rows: readonly LegacyRow[],
): EntityAboutDocument {
  const sources: AboutSource[] = [];
  const sourceIdByUrl = new Map<string, string>();
  const events = rows.map((row) => {
    let citations: EntityAboutDocument["events"][number]["citations"] = [];
    if (row.sourceUrl) {
      const key = normalizeSourceUrl(row.sourceUrl);
      let sourceId = sourceIdByUrl.get(key);
      if (!sourceId) {
        sourceId = `s${sources.length + 1}`;
        sourceIdByUrl.set(key, sourceId);
        sources.push({
          id: sourceId,
          url: row.sourceUrl,
          title: new URL(row.sourceUrl).hostname.replace(/^www\./, ""),
          publisher: null,
          publishedOn: null,
          kind: "reference",
          status: "available",
        });
      }
      citations = [{ sourceId, statedValue: null, quote: null }];
    }
    return {
      id: row.id,
      kind: row.kind,
      date: row.date,
      endDate: null,
      continuing: false,
      name: null,
      title: null,
      text: row.description,
      relatedEntityId: null,
      newOwnerId: row.newOwnerId,
      newOwnerName: null,
      citations,
      writtenBy:
        row.actorType === "user" ? ("person" as const) : ("pipeline" as const),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
  return { sources, events, siteFacts: {}, sections: [] };
}

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/backfill-entity-about",
    summary: "Copy entity history into About documents",
    description:
      "Copy a page of Entities' legacy history items into their About documents. Items already in a document are skipped, so the call is safe to repeat. Continue with `nextAfterId` until it is null. Requires administrator privileges.",
    operationId: "backfillEntityAbout",
  })
  .input(
    z
      .object({
        afterId: z
          .number()
          .int()
          .nonnegative()
          .default(0)
          .describe(
            "Copy history for Entities with IDs greater than this value",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(100)
          .describe("Number of Entities to copy"),
      })
      .strict(),
  )
  .output(
    z.object({
      copiedEvents: z.number(),
      entities: z.number(),
      nextAfterId: z.number().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const entityRows = await db
      .selectDistinct({ id: entityEvents.entityId })
      .from(entityEvents)
      .where(gt(entityEvents.entityId, input.afterId))
      .orderBy(asc(entityEvents.entityId))
      .limit(input.limit + 1);
    const page = entityRows.slice(0, input.limit).map((row) => row.id);
    if (!page.length)
      return { copiedEvents: 0, entities: 0, nextAfterId: null };

    const rows = await db
      .select({
        event: entityEvents,
        actorType: actors.type,
      })
      .from(entityEvents)
      .innerJoin(actors, eq(actors.id, entityEvents.createdByActorId))
      .where(inArray(entityEvents.entityId, page))
      .orderBy(asc(entityEvents.date), asc(entityEvents.id));
    const names = new Map(
      (
        await db
          .select({ id: entities.id, name: entities.name, kind: entities.kind })
          .from(entities)
          .where(inArray(entities.id, page))
      ).map((row) => [row.id, row]),
    );

    let copiedEvents = 0;
    for (const entityId of page) {
      const legacyRows = rows
        .filter((row) => row.event.entityId === entityId)
        .map((row) => ({ ...row.event, actorType: row.actorType }));
      const entity = names.get(entityId);
      if (!entity) continue;

      await db.transaction(async (tx) => {
        const stored = await getEntityAbout(tx, entityId, { forUpdate: true });
        const present = new Set(stored?.document.events.map((e) => e.id));
        const missing = legacyRows.filter((row) => !present.has(row.id));
        if (!missing.length) return;

        const legacy = buildDocumentFromLegacyEvents(missing);
        const document = stored
          ? mergeEntityAboutDocuments(stored.document, legacy)
          : legacy;
        const copied =
          document.events.length - (stored?.document.events.length ?? 0);
        if (copied !== missing.length) {
          throw new Error(
            `Copied ${copied} of ${missing.length} history items for entity ${entityId}.`,
          );
        }
        await saveEntityAbout(tx, {
          entity,
          document,
          expectedVersion: stored?.version ?? null,
          actor: await getPeatedSystemActorForDatabase(tx),
          // Copying is not new writing; legacy items keep their state.
          unchangedFrom: document,
        });
        copiedEvents += copied;
      });
    }

    return {
      copiedEvents,
      entities: page.length,
      nextAfterId: entityRows.length > input.limit ? page.at(-1)! : null,
    };
  });
