import {
  documentToDraft,
  draftToDocument,
} from "@peated/server/agents/entityAbout/draftSchema";
import {
  runEntityAboutWriter,
  type EntityAboutWriter,
} from "@peated/server/agents/entityAbout/writer";
import config from "@peated/server/config";
import { db, type AnyDatabase } from "@peated/server/db";
import {
  entities,
  entityAboutNotes,
  entityAliases,
  entityEvents,
} from "@peated/server/db/schema";
import {
  ABOUT_WRITER_SYSTEM_ACTOR_KEY,
  getSystemActorForDatabase,
} from "@peated/server/lib/actors";
import {
  keepFoundEntityLinks,
  reviewAboutDraft,
} from "@peated/server/lib/entityAbout/checks";
import { updateEntityDescription } from "@peated/server/lib/entityAbout/description";
import {
  EntityAboutVersionError,
  EntityAboutWriteError,
  getEntityAbout,
  saveEntityAbout,
} from "@peated/server/lib/entityAbout/store";
import { logWarn } from "@peated/server/lib/log";
import type { JobPayload } from "@peated/server/worker/types";
import { asc, eq } from "drizzle-orm";
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

/** Whether the writer can run: turned on, with the model and web tools. */
export const ENTITY_ABOUT_WRITER_READY =
  config.ENTITY_ABOUT_WRITER_ENABLED &&
  Boolean(config.AI_GATEWAY_API_KEY) &&
  Boolean(config.FIRECRAWL_API_KEY);

const defaultServices: WriteEntityAboutServices = {
  enabled: ENTITY_ABOUT_WRITER_READY,
  writer: runEntityAboutWriter,
  now: () => new Date(),
};

/**
 * The Entity's history rows as leads for the writer: each kind, date, text,
 * owner, and source URL a person entered.
 */
async function describeHistory(database: AnyDatabase, entityId: number) {
  const rows = await database
    .select({
      kind: entityEvents.kind,
      date: entityEvents.date,
      description: entityEvents.description,
      sourceUrl: entityEvents.sourceUrl,
      owner: entities.name,
    })
    .from(entityEvents)
    .leftJoin(entities, eq(entities.id, entityEvents.newOwnerId))
    .where(eq(entityEvents.entityId, entityId))
    .orderBy(asc(entityEvents.date));
  return rows.map((row) =>
    [
      `${row.kind}, ${row.date}`,
      row.owner ? `new owner ${row.owner}` : null,
      row.description,
      row.sourceUrl ? `source ${row.sourceUrl}` : null,
    ]
      .filter(Boolean)
      .join("; "),
  );
}

export type WriteEntityAboutResult =
  | { status: "disabled" | "skipped" }
  | { status: "rejected"; errors: string[] }
  | { status: "saved"; version: number };

/**
 * Writes the next version of an About page for one distillery or brand.
 * Pipeline rule (owner: docs/features/entity-about.md): the writer returns
 * the whole page, and a draft that fails the checks twice saves nothing.
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
  const history = await describeHistory(db, entity.id);
  const notes = await db
    .select({
      text: entityAboutNotes.text,
      sourceUrl: entityAboutNotes.sourceUrl,
    })
    .from(entityAboutNotes)
    .where(eq(entityAboutNotes.entityId, entity.id))
    .orderBy(asc(entityAboutNotes.id));
  // Read without a lock to guide the writer; the save checks the version.
  const current = await getEntityAbout(db, entity.id);

  let errors: string[] = [];
  let accepted = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !accepted; attempt += 1) {
    const {
      draft,
      pagesRead,
      entitiesFound = [],
    } = await services.writer({
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
      notes: notes.map((note) =>
        note.sourceUrl ? `${note.text} (from ${note.sourceUrl})` : note.text,
      ),
      history,
      currentPage: current ? documentToDraft(current.document) : null,
      previousErrors: errors,
    });
    const converted = draftToDocument(draft);
    const reviewed = reviewAboutDraft(
      converted.document,
      pagesRead,
      entity.kind,
      current?.document ?? null,
    );
    // An item the schema rejected is a reason to retry, not a silent gap.
    errors = [...converted.errors, ...reviewed.errors];
    if (!errors.length) {
      accepted = keepFoundEntityLinks(
        reviewed.document,
        entitiesFound,
        current?.document ?? null,
      );
    }
  }
  if (!accepted) return rejected(entity.id, errors);

  let saved;
  try {
    saved = await db.transaction(async (tx) => {
      // Lock order rule (owner: `mergeEntity`): the Entity row, then its
      // About row, so a merge running at the same time cannot deadlock.
      const [locked] = await tx
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.id, entity.id))
        .for("no key update");
      // The Entity was merged or deleted during the run.
      if (!locked) return null;
      const actor = await getSystemActorForDatabase(
        tx,
        ABOUT_WRITER_SYSTEM_ACTOR_KEY,
      );
      // A page edited during the run fails the version check.
      const result = await saveEntityAbout(tx, {
        entity,
        document: accepted,
        expectedVersion: current?.version ?? null,
        actor,
        checkedOn: services.now().toISOString().slice(0, 10),
      });
      await updateEntityDescription(tx, entity, result, actor);
      return result;
    });
  } catch (error) {
    // A person saved the page during the run. Their version is newer, so it
    // stays, and this run's draft is dropped.
    if (error instanceof EntityAboutVersionError) return { status: "skipped" };
    // Save rules the draft checks already cover; this is a backstop.
    if (!(error instanceof EntityAboutWriteError)) throw error;
    return rejected(entity.id, error.reasons);
  }

  if (!saved) return { status: "skipped" };
  return { status: "saved", version: saved.version };
}

function rejected(entityId: number, errors: string[]): WriteEntityAboutResult {
  // Log counts only; drafts can quote third-party pages.
  logWarn("About draft rejected", {
    extra: { entityId, errorCount: errors.length },
  });
  return { status: "rejected", errors };
}

export default async function writeEntityAboutJob(input: JobPayload) {
  await writeEntityAbout(input);
}
