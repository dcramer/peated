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
import { reviewAboutDraft } from "@peated/server/lib/entityAbout/checks";
import { mergePipelineDraft } from "@peated/server/lib/entityAbout/document";
import { toPublicEntityAbout } from "@peated/server/lib/entityAbout/publicAbout";
import {
  getEntityAbout,
  saveEntityAbout,
} from "@peated/server/lib/entityAbout/store";
import { logWarn } from "@peated/server/lib/log";
import type { JobPayload } from "@peated/server/worker/types";
import { eq } from "drizzle-orm";
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
      previousErrors: errors,
    });
    const now = services.now().toISOString();
    const converted = draftToDocument(draft, now);
    const reviewed = reviewAboutDraft(converted.document, pagesRead);
    errors = reviewed.errors;
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
    const today = services.now().toISOString().slice(0, 10);
    const actor = await getSystemActorForDatabase(
      tx,
      ABOUT_WRITER_SYSTEM_ACTOR_KEY,
    );
    const result = await saveEntityAbout(tx, {
      entity,
      document: mergePipelineDraft(
        stored?.document ?? null,
        document,
        services.now().toISOString(),
      ),
      expectedVersion: stored?.version ?? null,
      actor,
      checkedOn: today,
    });

    // A sourced lead replaces a generated description, never a person's.
    const lead = toPublicEntityAbout(result, new Map()).lead;
    const description = lead?.sentences.map((s) => s.text).join(" ");
    if (
      description &&
      entity.descriptionSrc !== "user" &&
      description !== entity.description
    ) {
      await tx
        .update(entities)
        .set({
          description,
          descriptionSrc: "generated",
          updatedAt: new Date(),
        })
        .where(eq(entities.id, entity.id));
      await tx.insert(changes).values({
        objectType: "entity",
        objectId: entity.id,
        displayName: entity.name,
        actorId: actor.id,
        type: "update",
        data: { description, descriptionSrc: "generated" },
      });
    }
    return result;
  });

  return { status: "saved", version: saved.version };
}

export default async function writeEntityAboutJob(input: JobPayload) {
  await writeEntityAbout(input);
}
