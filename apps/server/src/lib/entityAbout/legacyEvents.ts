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

export function isLegacyKind(kind: string): kind is LegacyKind {
  return (ENTITY_EVENT_KIND_LIST as readonly string[]).includes(kind);
}

export function toLegacyEvent(
  entityId: number,
  event: AboutEvent,
  sources: readonly AboutSource[],
): LegacyEvent | null {
  if (!isLegacyKind(event.kind)) return null;
  const sourceId = event.citations[0]?.sourceId;
  const now = new Date(0).toISOString();
  return {
    id: event.id,
    entityId,
    kind: event.kind,
    date: event.date,
    description: event.text,
    newOwnerId: event.newOwnerId,
    sourceUrl: sources.find((source) => source.id === sourceId)?.url ?? null,
    createdAt: event.createdAt ?? now,
    updatedAt: event.updatedAt ?? event.createdAt ?? now,
  };
}

/** Finds or adds a moderator-supplied source and returns its ID. */
export function ensureSource(
  document: EntityAboutDocument,
  url: string,
): { document: EntityAboutDocument; sourceId: string } {
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

export type LegacyEventInput = {
  kind: LegacyKind;
  date: string;
  description: string | null;
  newOwnerId: number | null;
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
  let next = document;
  let citations = before?.citations ?? [];
  const beforeUrl = toLegacyEvent(
    0,
    before ?? stubEvent(eventId),
    document.sources,
  )?.sourceUrl;
  if (input.sourceUrl === null) {
    citations = [];
  } else if (input.sourceUrl !== beforeUrl) {
    const added = ensureSource(next, input.sourceUrl);
    next = added.document;
    citations = [{ sourceId: added.sourceId, statedValue: null, quote: null }];
  }

  const event: AboutEvent = {
    ...(before ?? stubEvent(eventId)),
    kind: input.kind,
    date: input.date,
    text: input.description,
    newOwnerId: input.newOwnerId,
    newOwnerName: null,
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

function stubEvent(id: number): AboutEvent {
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
  const stored = await getEntityAbout(tx, entity.id);
  const document = edit(stored?.document ?? EMPTY_ABOUT_DOCUMENT);
  return await saveEntityAbout(tx, {
    entity,
    document,
    expectedVersion: stored?.version ?? null,
    actor,
  });
}
