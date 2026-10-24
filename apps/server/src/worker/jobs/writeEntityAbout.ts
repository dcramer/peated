import { draftToDocument } from "@peated/server/agents/entityAbout/draftSchema";
import {
  runEntityAboutWriter,
  type EntityAboutWriter,
} from "@peated/server/agents/entityAbout/writer";
import config from "@peated/server/config";
import { db, type AnyDatabase } from "@peated/server/db";
import {
  changes,
  entities,
  entityAliases,
  type Actor,
} from "@peated/server/db/schema";
import {
  ABOUT_WRITER_SYSTEM_ACTOR_KEY,
  getSystemActorForDatabase,
} from "@peated/server/lib/actors";
import {
  ABOUT_FACT_FIELD_LIST,
  ABOUT_FACT_FIELDS,
} from "@peated/server/lib/entityAbout/aboutFactFields";
import {
  checkMergedAbout,
  reviewAboutDraft,
} from "@peated/server/lib/entityAbout/checks";
import { isFactShown } from "@peated/server/lib/entityAbout/display";
import { mergePipelineDraft } from "@peated/server/lib/entityAbout/document";
import { getPublishedLeadText } from "@peated/server/lib/entityAbout/publicAbout";
import {
  EntityAboutWriteError,
  followMergedEntities,
  getEntityAbout,
  loadLinkedEntities,
  saveEntityAbout,
  type StoredEntityAbout,
} from "@peated/server/lib/entityAbout/store";
import { logWarn } from "@peated/server/lib/log";
import type {
  AboutCitation,
  AboutEvent,
  EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";
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

/** Names of the Entities a stored document links as new owners. */
async function loadOwnerNames(
  database: AnyDatabase,
  stored: EntityAboutDocument | null,
) {
  const ids = (stored?.events ?? []).flatMap((event) =>
    event.newOwnerId ? [event.newOwnerId] : [],
  );
  if (!ids.length) return new Map<number, string>();
  // A merged owner is named by the Entity it became.
  const target = await followMergedEntities(database, ids);
  const rows = await database
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(inArray(entities.id, [...new Set(target.values())]));
  const names = new Map(rows.map((row) => [row.id, row.name]));
  const ownerNames = new Map<number, string>();
  for (const id of ids) {
    const name = names.get(target.get(id) ?? id);
    if (name) ownerNames.set(id, name);
  }
  return ownerNames;
}

function describeEvent(
  event: AboutEvent,
  ownerNames: ReadonlyMap<number, string>,
) {
  const owner = event.newOwnerId
    ? ownerNames.get(event.newOwnerId)
    : event.newOwnerName;
  const details = [
    event.name ? `name ${event.name}` : null,
    owner ? `new owner ${owner}` : null,
    event.text?.slice(0, 300),
  ].filter(Boolean);
  return `#${event.id} ${event.kind}, ${event.date}${details.length ? `: ${details.join("; ")}` : ""}`;
}

/**
 * Lists stored history the page cannot show yet, so the writer can look for
 * sources. A matching event in the draft adds its citations to the stored
 * one (see `mergePipelineDraft`).
 */
function describeUnsourcedHistory(
  stored: EntityAboutDocument | null,
  ownerNames: ReadonlyMap<number, string>,
) {
  if (!stored) return [];
  return stored.events
    .filter((event) => !isFactShown(event.citations, stored.sources))
    .map((event) => describeEvent(event, ownerNames));
}

/**
 * Lists the shown facts this run replaces, with where they were found. A
 * draft that shows fewer facts is rejected (see `checkMergedAbout`), so the
 * writer checks these again first.
 */
function describeShownFacts(
  stored: EntityAboutDocument | null,
  ownerNames: ReadonlyMap<number, string>,
) {
  if (!stored) return [];
  const urls = new Map(stored.sources.map((source) => [source.id, source.url]));
  const cited = (citations: readonly AboutCitation[]) => {
    const found = [
      ...new Set(citations.flatMap((c) => urls.get(c.sourceId) ?? [])),
    ];
    return found.length ? ` (found on ${found.join(", ")})` : "";
  };
  const shown = (citations: readonly AboutCitation[]) =>
    isFactShown(citations, stored.sources);
  return [
    ...stored.events
      .filter(
        (event) => event.writtenBy === "pipeline" && shown(event.citations),
      )
      .map(
        (event) => describeEvent(event, ownerNames) + cited(event.citations),
      ),
    ...ABOUT_FACT_FIELD_LIST.flatMap((field) => {
      const fact = stored.siteFacts[field];
      if (!fact || fact.writtenBy !== "pipeline" || !shown(fact.citations)) {
        return [];
      }
      return [
        `${ABOUT_FACT_FIELDS[field].label}: ${fact.value}${cited(fact.citations)}`,
      ];
    }),
  ];
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
  const ownerNames = await loadOwnerNames(db, before?.document ?? null);
  const unsourcedHistory = describeUnsourcedHistory(
    before?.document ?? null,
    ownerNames,
  );
  const shownFacts = describeShownFacts(before?.document ?? null, ownerNames);

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
      shownFacts,
      previousErrors: errors,
    });
    const now = services.now().toISOString();
    const converted = draftToDocument(draft, now);
    const reviewed = reviewAboutDraft(
      converted.document,
      pagesRead,
      entity.kind,
    );
    // An item the schema rejected is a reason to retry, not a silent gap.
    errors = [...converted.errors, ...reviewed.errors];
    if (!errors.length) {
      errors = mergeAndCheck(before, reviewed.document, now, ownerNames).errors;
    }
    if (!errors.length) accepted = reviewed.document;
  }
  if (!accepted) return rejected(entity.id, errors);

  const document = accepted;
  let saved;
  try {
    saved = await db.transaction(async (tx) => {
      // Lock order rule (owner: `mergeEntity`): the Entity row, then its
      // About row, so a merge running at the same time cannot deadlock.
      // NO KEY UPDATE still waits on a merge's lock, but not on the key-share
      // lock an About edit's first insert takes on the Entity.
      await tx
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.id, entity.id))
        .for("no key update");
      const stored = await getEntityAbout(tx, entity.id, { forUpdate: true });
      const now = services.now();
      // Owners are read again: a moderator may have linked one mid-run.
      const { merged, errors } = mergeAndCheck(
        stored,
        document,
        now.toISOString(),
        await loadOwnerNames(tx, stored?.document ?? null),
      );
      // The page changed between the draft and the save.
      if (errors.length) return { errors };

      const actor = await getSystemActorForDatabase(
        tx,
        ABOUT_WRITER_SYSTEM_ACTOR_KEY,
      );
      const result = await saveEntityAbout(tx, {
        entity,
        document: merged,
        expectedVersion: stored?.version ?? null,
        actor,
        checkedOn: now.toISOString().slice(0, 10),
      });
      await updateDescription(tx, entity, result, actor);
      return { errors, version: result.version };
    });
  } catch (error) {
    // Items a person wrote can break a store rule the draft cannot fix, such
    // as a site fact kept after the Entity's kind changed. A moderator fixes
    // those; retrying the job would fail the same way.
    if (!(error instanceof EntityAboutWriteError)) throw error;
    saved = { errors: error.reasons };
  }

  if (!saved.version) return rejected(entity.id, saved.errors);
  return { status: "saved", version: saved.version };
}

function mergeAndCheck(
  stored: StoredEntityAbout | null,
  document: EntityAboutDocument,
  now: string,
  ownerNames: ReadonlyMap<number, string>,
) {
  const merged = mergePipelineDraft(
    stored?.document ?? null,
    document,
    now,
    ownerNames,
  );
  return { merged, errors: checkMergedAbout(stored?.document ?? null, merged) };
}

function rejected(entityId: number, errors: string[]): WriteEntityAboutResult {
  // Log counts only; drafts can quote third-party pages.
  logWarn("About draft rejected", {
    extra: { entityId, errorCount: errors.length },
  });
  return { status: "rejected", errors };
}

/**
 * A published, sourced lead replaces a generated or empty description, never
 * a person's or one of unknown origin. The check is in the update itself, so
 * an edit made during the run wins.
 */
async function updateDescription(
  tx: AnyDatabase,
  entity: { id: number; name: string },
  about: StoredEntityAbout,
  actor: Actor,
) {
  const description = getPublishedLeadText(
    about,
    await loadLinkedEntities(tx, [about.document]),
  );
  if (!description) return;
  const [updated] = await tx
    .update(entities)
    .set({ description, descriptionSrc: "generated", updatedAt: new Date() })
    .where(
      and(
        eq(entities.id, entity.id),
        or(
          isNull(entities.description),
          eq(entities.description, ""),
          and(
            eq(entities.descriptionSrc, "generated"),
            ne(entities.description, description),
          ),
        ),
      ),
    )
    .returning({ id: entities.id });
  if (!updated) return;
  await tx.insert(changes).values({
    objectType: "entity",
    objectId: entity.id,
    displayName: entity.name,
    actorId: actor.id,
    type: "update",
    data: { description, descriptionSrc: "generated" },
  });
}

export default async function writeEntityAboutJob(input: JobPayload) {
  await writeEntityAbout(input);
}
