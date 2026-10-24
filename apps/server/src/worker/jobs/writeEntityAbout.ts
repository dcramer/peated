import { draftToDocument } from "@peated/server/agents/entityAbout/draftSchema";
import {
  runEntityAboutWriter,
  type EntityAboutWriter,
} from "@peated/server/agents/entityAbout/writer";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { changes, entities, entityAliases } from "@peated/server/db/schema";
import {
  ABOUT_WRITER_SYSTEM_ACTOR_KEY,
  getSystemActorForDatabase,
} from "@peated/server/lib/actors";
import {
  checkMergedAbout,
  reviewAboutDraft,
} from "@peated/server/lib/entityAbout/checks";
import { isFactShown } from "@peated/server/lib/entityAbout/display";
import { mergePipelineDraft } from "@peated/server/lib/entityAbout/document";
import { toPublicEntityAbout } from "@peated/server/lib/entityAbout/publicAbout";
import {
  getEntityAbout,
  saveEntityAbout,
} from "@peated/server/lib/entityAbout/store";
import { logWarn } from "@peated/server/lib/log";
import type { EntityAboutDocument } from "@peated/server/schemas/entityAbout";
import type { JobPayload } from "@peated/server/worker/types";
import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";

export const WriteEntityAboutJobArgsSchema = z
  .object({ entityId: z.number().int().positive() })
  .strict();

const MAX_ATTEMPTS = 2;

type WriteEntityAboutServices = {
  enabled: boolean;
  writer: EntityAboutWriter;
  now: () => Date;
};

const defaultServices: WriteEntityAboutServices = {
  enabled:
    config.ENTITY_ABOUT_WRITER_ENABLED && Boolean(config.AI_GATEWAY_API_KEY),
  writer: runEntityAboutWriter,
  now: () => new Date(),
};

/**
 * Lists stored history the page cannot show yet, so the writer can look for
 * sources. A matching event in the draft adds its citations to the stored
 * one (see `mergePipelineDraft`).
 */
async function describeUnsourcedHistory(stored: EntityAboutDocument | null) {
  if (!stored) return [];
  const { events, sources } = stored;
  const hidden = events.filter(
    (event) => !isFactShown(event.citations, sources),
  );
  const ownerIds = hidden.flatMap((event) =>
    event.newOwnerId ? [event.newOwnerId] : [],
  );
  const owners = new Map(
    ownerIds.length
      ? (
          await db
            .select({ id: entities.id, name: entities.name })
            .from(entities)
            .where(inArray(entities.id, ownerIds))
        ).map((row) => [row.id, row.name])
      : [],
  );
  return hidden.map((event) => {
    const owner = event.newOwnerId
      ? owners.get(event.newOwnerId)
      : event.newOwnerName;
    const details = [
      event.name ? `name ${event.name}` : null,
      owner ? `new owner ${owner}` : null,
      event.text?.slice(0, 300),
    ].filter(Boolean);
    return `#${event.id} ${event.kind}, ${event.date}${details.length ? `: ${details.join("; ")}` : ""}`;
  });
}

export type WriteEntityAboutResult =
  | { status: "disabled" | "skipped" }
  | { status: "rejected"; errors: string[] }
  | { status: "saved"; version: number };

/**
 * Writes an About document for one distillery or brand. Pipeline rule
 * (owner: docs/features/entity-about.md): a draft that fails the checks twice
 * saves nothing, and items a person wrote are never changed.
 */
export async function writeEntityAbout(
  input: JobPayload,
  services: WriteEntityAboutServices = defaultServices,
): Promise<WriteEntityAboutResult> {
  const { entityId } = WriteEntityAboutJobArgsSchema.parse(input);
  if (!services.enabled) return { status: "disabled" };

  const entity = await db.query.entities.findFirst({
    where: (table, { eq }) => eq(table.id, entityId),
    with: { country: true, region: true, owner: true },
  });
  if (!entity || (entity.kind !== "distillery" && entity.kind !== "brand")) {
    return { status: "skipped" };
  }
  const aliases = await db
    .select({ name: entityAliases.name })
    .from(entityAliases)
    .where(eq(entityAliases.entityId, entity.id));
  // Read without a lock to guide the writer; the save checks again under one.
  const before = await getEntityAbout(db, entity.id);
  const unsourcedHistory = await describeUnsourcedHistory(
    before?.document ?? null,
  );

  let errors: string[] = [];
  let accepted = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !accepted; attempt += 1) {
    const { draft, pagesRead } = await services.writer({
      entityId: entity.id,
      name: entity.name,
      kind: entity.kind,
      aliases: aliases.map((alias) => alias.name),
      location:
        [entity.region?.name, entity.country?.name]
          .filter(Boolean)
          .join(", ") || null,
      owner: entity.owner?.name ?? null,
      yearEstablished: entity.yearEstablished,
      website: entity.website,
      unsourcedHistory,
      previousErrors: errors,
    });
    const now = services.now().toISOString();
    const converted = draftToDocument(draft, now);
    const reviewed = reviewAboutDraft(
      converted.document,
      pagesRead,
      entity.kind,
    );
    errors = reviewed.errors.length
      ? reviewed.errors
      : checkMergedAbout(
          before?.document ?? null,
          mergePipelineDraft(before?.document ?? null, reviewed.document, now),
        );
    if (!errors.length) accepted = reviewed.document;
  }

  if (!accepted) {
    // Log counts only; drafts can quote third-party pages.
    logWarn("About draft rejected", {
      extra: { entityId: entity.id, errorCount: errors.length },
    });
    return { status: "rejected", errors };
  }

  const document = accepted;
  const saved = await db.transaction(async (tx) => {
    const stored = await getEntityAbout(tx, entity.id, { forUpdate: true });
    const merged = mergePipelineDraft(
      stored?.document ?? null,
      document,
      services.now().toISOString(),
    );
    const mergeErrors = checkMergedAbout(stored?.document ?? null, merged);
    if (mergeErrors.length) return { errors: mergeErrors, version: null };

    const today = services.now().toISOString().slice(0, 10);
    const actor = await getSystemActorForDatabase(
      tx,
      ABOUT_WRITER_SYSTEM_ACTOR_KEY,
    );
    const result = await saveEntityAbout(tx, {
      entity,
      document: merged,
      expectedVersion: stored?.version ?? null,
      actor,
      checkedOn: today,
    });

    // A sourced lead replaces a generated description, never a person's.
    // The check is in the update itself, so an edit made during the run wins.
    const lead = toPublicEntityAbout(result, new Map()).lead;
    const description = lead?.sentences.map((s) => s.text).join(" ");
    const [updated] = description
      ? await tx
          .update(entities)
          .set({
            description,
            descriptionSrc: "generated",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(entities.id, entity.id),
              or(
                isNull(entities.descriptionSrc),
                ne(entities.descriptionSrc, "user"),
              ),
              or(
                isNull(entities.description),
                ne(entities.description, description),
              ),
            ),
          )
          .returning({ id: entities.id })
      : [];
    if (updated) {
      await tx.insert(changes).values({
        objectType: "entity",
        objectId: entity.id,
        displayName: entity.name,
        actorId: actor.id,
        type: "update",
        data: { description, descriptionSrc: "generated" },
      });
    }
    return { errors: [], version: result.version };
  });

  if (saved.version === null) {
    // The page changed between the draft and the save.
    logWarn("About draft rejected", {
      extra: { entityId: entity.id, errorCount: saved.errors.length },
    });
    return { status: "rejected", errors: saved.errors };
  }
  return { status: "saved", version: saved.version };
}

export default async function writeEntityAboutJob(input: JobPayload) {
  await writeEntityAbout(input);
}
