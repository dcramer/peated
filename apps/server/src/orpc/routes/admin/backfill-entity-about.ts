import { db } from "@peated/server/db";
import { entities, entityEvents } from "@peated/server/db/schema";
import { getPeatedSystemActorForDatabase } from "@peated/server/lib/actors";
import {
  EMPTY_ABOUT_DOCUMENT,
  addHistory,
} from "@peated/server/lib/entityAbout/document";
import {
  blankAboutEvent,
  ensureSource,
} from "@peated/server/lib/entityAbout/legacyEvents";
import {
  EntityAboutWriteError,
  getEntityAbout,
  saveEntityAbout,
} from "@peated/server/lib/entityAbout/store";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import type {
  AboutCitation,
  AboutEvent,
  EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";
import { asc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";

type LegacyRow = typeof entityEvents.$inferSelect;

/** Builds an About document from one Entity's `entity_event` rows. */
function buildDocumentFromLegacyEvents(
  rows: readonly LegacyRow[],
): EntityAboutDocument {
  let document = EMPTY_ABOUT_DOCUMENT;
  for (const row of rows) {
    let citations: AboutCitation[] = [];
    if (row.sourceUrl) {
      const added = ensureSource(document, row.sourceUrl);
      document = added.document;
      citations = [
        { sourceId: added.sourceId, statedValue: null, quote: null },
      ];
    }
    const event: AboutEvent = {
      ...blankAboutEvent(row.id),
      kind: row.kind,
      date: row.date,
      text: row.description,
      newOwnerId: row.newOwnerId,
      legacyEventId: row.id,
      citations,
      // Legacy history is the curated record: the writer may add sources to
      // it but never replaces it.
      writtenBy: "person",
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
    document = { ...document, events: [...document.events, event] };
  }
  return document;
}

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/backfill-entity-about",
    summary: "Copy entity history into About documents",
    description:
      "Copy a page of Entities' legacy history items into their About documents. Items already in a document are skipped, so the call is safe to repeat. An Entity whose history cannot be saved is listed in `failed` with the reasons, and the rest of the page continues. Continue with `nextAfterId` until it is null. Requires administrator privileges.",
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
      failed: z.array(
        z.object({ entityId: z.number(), reasons: z.array(z.string()) }),
      ),
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
      return { copiedEvents: 0, entities: 0, failed: [], nextAfterId: null };

    const rows = await db
      .select()
      .from(entityEvents)
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

    const actor = await getPeatedSystemActorForDatabase(db);
    let copiedEvents = 0;
    const failed: { entityId: number; reasons: string[] }[] = [];
    for (const entityId of page) {
      const legacyRows = rows.filter((row) => row.entityId === entityId);
      const entity = names.get(entityId);
      if (!entity) continue;

      // Legacy rows that break a store rule are reported, not skipped
      // silently, so one bad row does not stall the backfill.
      const badUrls = legacyRows.filter(
        (row) => row.sourceUrl && !URL.canParse(row.sourceUrl),
      );
      if (badUrls.length) {
        failed.push({
          entityId,
          reasons: badUrls.map(
            (row) => `History item ${row.id} has an invalid source URL.`,
          ),
        });
        continue;
      }

      try {
        await db.transaction(async (tx) => {
          const stored = await getEntityAbout(tx, entityId, {
            forUpdate: true,
          });
          // Copy rule: each `entity_event` row is copied once, matched by
          // `legacyEventId`; document event IDs are per document and can
          // collide with legacy row IDs.
          const present = new Set(
            stored?.document.events.flatMap((event) =>
              event.legacyEventId ? [event.legacyEventId] : [],
            ),
          );
          const missing = legacyRows.filter((row) => !present.has(row.id));
          if (!missing.length) return;

          const legacy = buildDocumentFromLegacyEvents(missing);
          const document = stored
            ? addHistory(stored.document, legacy)
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
            actor,
            // Copying is not new writing; legacy items keep their state.
            unchangedFrom: document,
          });
          copiedEvents += copied;
        });
      } catch (error) {
        if (!(error instanceof EntityAboutWriteError)) throw error;
        failed.push({ entityId, reasons: error.reasons });
      }
    }

    return {
      copiedEvents,
      entities: page.length,
      failed,
      nextAfterId: entityRows.length > input.limit ? page.at(-1)! : null,
    };
  });
