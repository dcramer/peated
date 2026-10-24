import { ENTITY_EVENT_KIND_LIST } from "@peated/server/constants";
import type { AnyDatabase } from "@peated/server/db";
import type { Actor, EntityKind } from "@peated/server/db/schema";
import type {
  AboutEvent,
  AboutSource,
  EntityAboutDocument,
  EntityEventSchema,
} from "@peated/server/schemas";
import type { z } from "zod";

import {
  EMPTY_ABOUT_DOCUMENT,
  normalizeSourceUrl,
  pruneSources,
} from "./document";
import { getEntityAbout, saveEntityAbout } from "./store";

// The `/entities/{entity}/events` routes predate About documents. They read
// and write the document's history and keep their original response shape.

type LegacyKind = (typeof ENTITY_EVENT_KIND_LIST)[number];
type LegacyEvent = z.infer<typeof EntityEventSchema>;

// Items stored before About documents have no timestamps.
const UNKNOWN_TIME = new Date(0).toISOString();

function isLegacyKind(kind: string): kind is LegacyKind {
  return ENTITY_EVENT_KIND_LIST.some((legacyKind) => legacyKind === kind);
}

export function toLegacyEvent(
  entityId: number,
  event: AboutEvent,
  sources: readonly AboutSource[],
): LegacyEvent | null {
  if (!isLegacyKind(event.kind)) return null;
  return {
    id: event.id,
    entityId,
    kind: event.kind,
    date: event.date,
    description: event.text,
    newOwnerId: event.newOwnerId,
    newOwnerName: event.newOwnerName,
    sourceUrl: citedUrl(event, sources),
    createdAt: event.createdAt ?? UNKNOWN_TIME,
    updatedAt: event.updatedAt ?? event.createdAt ?? UNKNOWN_TIME,
  };
}

/** The URL of an event's first source; legacy history shows one. */
function citedUrl(event: AboutEvent, sources: readonly AboutSource[]) {
  const sourceId = event.citations[0]?.sourceId;
  return sources.find((source) => source.id === sourceId)?.url ?? null;
}

/** Finds or adds a moderator-supplied source and returns its ID. */
export function ensureSource(document: EntityAboutDocument, url: string) {
  const normalized = normalizeSourceUrl(url);
  const existing = document.sources.find(
    (source) => normalizeSourceUrl(source.url) === normalized,
  );
  if (existing) return { document, sourceId: existing.id };

  const ids = new Set(document.sources.map((source) => source.id));
  let n = document.sources.length + 1;
  while (ids.has(`s${n}`)) n += 1;
  const sourceId = `s${n}`;
  const source: AboutSource = {
    id: sourceId,
    url,
    title: new URL(url).hostname.replace(/^www\./, ""),
    publisher: null,
    publishedOn: null,
    kind: "reference",
    status: "available",
  };
  return {
    document: { ...document, sources: [...document.sources, source] },
    sourceId,
  };
}

type LegacyEventInput = {
  kind: LegacyKind;
  date: string;
  description: string | null;
  newOwnerId: number | null;
  newOwnerName: string | null;
  sourceUrl: string | null;
};

/** Writes one history item as a person and returns the updated document. */
export function putLegacyEvent(
  document: EntityAboutDocument,
  eventId: number,
  input: LegacyEventInput,
  now: string,
): EntityAboutDocument {
  const before = document.events.find((event) => event.id === eventId);
  // An edit that changes nothing leaves the item, and who wrote it, as is.
  if (
    before &&
    before.kind === input.kind &&
    before.date === input.date &&
    before.text === input.description &&
    before.newOwnerId === input.newOwnerId &&
    before.newOwnerName === (input.newOwnerId ? null : input.newOwnerName) &&
    citedUrl(before, document.sources) === input.sourceUrl
  ) {
    return document;
  }
  let next = document;
  let citations = before?.citations ?? [];
  if (input.sourceUrl === null) {
    citations = [];
  } else if (
    !before ||
    input.sourceUrl !== citedUrl(before, document.sources)
  ) {
    const added = ensureSource(next, input.sourceUrl);
    next = added.document;
    citations = [{ sourceId: added.sourceId, statedValue: null, quote: null }];
  } else if (before.date !== input.date || before.kind !== input.kind) {
    // The source stays, but what it was quoted as stating no longer fits.
    citations = citations.map((citation) => ({
      ...citation,
      statedValue: null,
      quote: null,
    }));
  }

  const event: AboutEvent = {
    ...(before ?? blankAboutEvent(eventId)),
    kind: input.kind,
    date: input.date,
    text: input.description,
    newOwnerId: input.newOwnerId,
    // A linked owner replaces a name-only one.
    newOwnerName: input.newOwnerId ? null : input.newOwnerName,
    citations,
    writtenBy: "person",
    createdAt: before?.createdAt ?? now,
    updatedAt: now,
  };
  const events = before
    ? next.events.map((item) => (item.id === eventId ? event : item))
    : [...next.events, event];
  return pruneSources({ ...next, events });
}

/** An event with every optional field empty, for callers to fill in. */
export function blankAboutEvent(id: number): AboutEvent {
  return {
    id,
    kind: "generic",
    date: "1900",
    endDate: null,
    continuing: false,
    name: null,
    title: null,
    text: null,
    relatedEntityId: null,
    newOwnerId: null,
    newOwnerName: null,
    legacyEventId: null,
    citations: [],
    writtenBy: "person",
    createdAt: null,
    updatedAt: null,
  };
}

export function nextEventId(document: EntityAboutDocument) {
  return Math.max(0, ...document.events.map((event) => event.id)) + 1;
}

/** Loads, edits, and saves an Entity's history in one transaction. */
export async function editEntityHistory(
  tx: AnyDatabase,
  {
    entity,
    actor,
    edit,
  }: {
    entity: { id: number; name: string; kind: EntityKind };
    actor: Actor;
    edit: (document: EntityAboutDocument) => EntityAboutDocument;
  },
) {
  const stored = await getEntityAbout(tx, entity.id, { forUpdate: true });
  const document = edit(stored?.document ?? EMPTY_ABOUT_DOCUMENT);
  // An edit that changes nothing saves nothing, so the version holds.
  if (stored && document === stored.document) return stored;
  return await saveEntityAbout(tx, {
    entity,
    document,
    expectedVersion: stored?.version ?? null,
    actor,
  });
}
