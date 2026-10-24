import type {
  AboutCitation,
  AboutEvent,
  AboutSection,
  AboutSource,
  EntityAboutDocument,
} from "@peated/server/schemas/entityAbout";

import { ABOUT_FACT_FIELD_LIST } from "./aboutFactFields";
import {
  eventFactId,
  getFactCitations,
  siteFactId,
  valuesAgree,
} from "./display";

export const EMPTY_ABOUT_DOCUMENT: EntityAboutDocument = {
  sources: [],
  events: [],
  siteFacts: {},
  sections: [],
};

export function normalizeSourceUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.protocol = "https:";
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.hostname}${path}${url.search}`;
}

/** Removes sources that no citation uses. */
export function pruneSources(
  document: EntityAboutDocument,
): EntityAboutDocument {
  const used = new Set<string>();
  for (const citations of getFactCitations(document).values()) {
    for (const citation of citations) used.add(citation.sourceId);
  }
  return {
    ...document,
    sources: document.sources.filter((source) => used.has(source.id)),
  };
}

function sameItem<T>(left: T, right: T) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function withoutTimestamps(event: AboutEvent) {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = event;
  return rest;
}

/**
 * Returns why a document cannot be saved. Structural rules apply to the whole
 * document. The source rule applies to new or changed items, so legacy
 * history without a source can stay stored (and hidden) until someone cites
 * it.
 */
export function findAboutWriteErrors(
  stored: EntityAboutDocument | null,
  next: EntityAboutDocument,
) {
  const errors: string[] = [];

  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  for (const source of next.sources) {
    if (sourceIds.has(source.id))
      errors.push(`Source ${source.id} is listed twice.`);
    const url = normalizeSourceUrl(source.url);
    if (sourceUrls.has(url))
      errors.push(`Source ${source.url} is listed twice.`);
    sourceIds.add(source.id);
    sourceUrls.add(url);
  }

  for (const [factId, citations] of getFactCitations(next)) {
    for (const citation of citations) {
      if (!sourceIds.has(citation.sourceId)) {
        errors.push(`${factId} cites unknown source ${citation.sourceId}.`);
      }
    }
  }

  const eventIds = new Set<number>();
  for (const event of next.events) {
    if (eventIds.has(event.id))
      errors.push(`Event ${event.id} is listed twice.`);
    eventIds.add(event.id);
  }

  const storedEvents = new Map(
    (stored?.events ?? []).map((event) => [event.id, event]),
  );
  for (const event of next.events) {
    const before = storedEvents.get(event.id);
    const changed =
      !before || !sameItem(withoutTimestamps(before), withoutTimestamps(event));
    if (changed && !event.citations.length) {
      errors.push(`Event ${event.id} needs a source.`);
    }
  }

  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = next.siteFacts[field];
    if (!fact) continue;
    const before = stored?.siteFacts[field];
    if ((!before || !sameItem(before, fact)) && !fact.citations.length) {
      errors.push(`Site fact ${field} needs a source.`);
    }
  }

  const factIds = new Set(getFactCitations(next).keys());
  const sectionKeys = new Set<string>();
  for (const section of next.sections) {
    if (sectionKeys.has(section.key)) {
      errors.push(`Section ${section.key} is listed twice.`);
    }
    sectionKeys.add(section.key);
    if (section.eraEventId && !eventIds.has(section.eraEventId)) {
      errors.push(`Section ${section.key} names a missing era.`);
    }
    for (const sentence of section.sentences) {
      if (!sentence.factIds.length) {
        errors.push(`A sentence in ${section.key} needs a source.`);
      }
      for (const factId of sentence.factIds) {
        if (!factIds.has(factId)) {
          errors.push(`A sentence in ${section.key} cites missing ${factId}.`);
        }
      }
    }
  }

  return errors;
}

/**
 * Marks items a moderator added or changed as written by a person. Unchanged
 * items keep their author.
 */
export function markPersonEdits(
  stored: EntityAboutDocument | null,
  next: EntityAboutDocument,
  now: string,
): EntityAboutDocument {
  const storedEvents = new Map(
    (stored?.events ?? []).map((event) => [event.id, event]),
  );
  const storedSections = new Map(
    (stored?.sections ?? []).map((section) => [section.key, section]),
  );

  const events = next.events.map((event): AboutEvent => {
    const before = storedEvents.get(event.id);
    const unchanged =
      before &&
      sameItem(
        { ...withoutTimestamps(before), writtenBy: null },
        { ...withoutTimestamps(event), writtenBy: null },
      );
    if (unchanged) return before;
    return {
      ...event,
      writtenBy: "person",
      createdAt: before?.createdAt ?? now,
      updatedAt: now,
    };
  });

  const siteFacts: EntityAboutDocument["siteFacts"] = {};
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = next.siteFacts[field];
    if (!fact) continue;
    const before = stored?.siteFacts[field];
    const unchanged =
      before &&
      sameItem({ ...before, writtenBy: null }, { ...fact, writtenBy: null });
    siteFacts[field] = unchanged ? before : { ...fact, writtenBy: "person" };
  }

  const sections = next.sections.map((section): AboutSection => {
    const before = storedSections.get(section.key);
    const unchanged =
      before &&
      sameItem({ ...before, writtenBy: null }, { ...section, writtenBy: null });
    return unchanged ? before : { ...section, writtenBy: "person" };
  });

  return pruneSources({ ...next, events, siteFacts, sections });
}

type IdMaps = { sources: Map<string, string>; events: Map<number, number> };

/**
 * Adds incoming sources and events to a base document, combining sources
 * with the same URL and renumbering events that would collide. Returns the
 * ID maps so callers can rewrite references.
 */
function absorbSourcesAndEvents(
  base: EntityAboutDocument,
  incoming: EntityAboutDocument,
  events: readonly AboutEvent[],
) {
  const maps: IdMaps = { sources: new Map(), events: new Map() };
  const sources: AboutSource[] = [...base.sources];
  const byUrl = new Map(
    sources.map((source) => [normalizeSourceUrl(source.url), source.id]),
  );
  const usedIds = new Set(sources.map((source) => source.id));
  for (const source of incoming.sources) {
    const existing = byUrl.get(normalizeSourceUrl(source.url));
    if (existing) {
      maps.sources.set(source.id, existing);
      continue;
    }
    let id = source.id;
    for (let n = 2; usedIds.has(id); n += 1) id = `${source.id}-${n}`;
    usedIds.add(id);
    byUrl.set(normalizeSourceUrl(source.url), id);
    maps.sources.set(source.id, id);
    sources.push({ ...source, id });
  }

  let nextEventId = Math.max(0, ...base.events.map((event) => event.id)) + 1;
  const usedEventIds = new Set(base.events.map((event) => event.id));
  const absorbed = events.map((event) => {
    const id = usedEventIds.has(event.id) ? nextEventId++ : event.id;
    usedEventIds.add(id);
    nextEventId = Math.max(nextEventId, id + 1);
    maps.events.set(event.id, id);
    return {
      ...event,
      id,
      citations: event.citations.map((citation) => ({
        ...citation,
        sourceId: maps.sources.get(citation.sourceId) ?? citation.sourceId,
      })),
    };
  });

  return { sources, events: [...base.events, ...absorbed], maps };
}

function remapFactId(factId: string, maps: IdMaps) {
  const match = /^event:(\d+)$/.exec(factId);
  if (!match) return factId;
  const id = maps.events.get(Number(match[1]));
  return id ? eventFactId(id) : factId;
}

function sameText(left: string | null, right: string | null) {
  return (
    left !== null &&
    right !== null &&
    left.trim().toLowerCase() === right.trim().toLowerCase()
  );
}

/**
 * Whether a draft event states the same fact as a kept one: same kind, dates
 * that agree, and the same name, owner, title, or text where the kind has
 * one. A writer may also reuse the ID of a listed item without a source.
 * Unknown details never match, because many things happen in one year.
 */
function sameEvent(kept: AboutEvent, draft: AboutEvent) {
  if (kept.kind !== draft.kind || !valuesAgree(kept.date, draft.date)) {
    return false;
  }
  // Only stored history without a source is listed to the writer.
  if (!kept.citations.length && kept.id === draft.id) return true;
  switch (draft.kind) {
    case "generic":
      return sameText(kept.text, draft.text);
    case "renamed":
      return sameText(kept.name, draft.name);
    case "acquired":
      return sameText(kept.newOwnerName, draft.newOwnerName);
    case "era":
      return sameText(kept.title, draft.title);
    case "opened":
    case "closed":
    case "mothballed":
    case "reopened":
      return true;
  }
}

/**
 * Merges a pipeline draft into the stored document. Pipeline rule (owner:
 * docs/features/entity-about.md): everything a person wrote stays, and so
 * do history without a source and pipeline facts a person's section cites.
 * The draft replaces only the pipeline's other items. A draft event that
 * matches a kept event (same kind, dates that agree) adds its citations to
 * the kept event instead of repeating it.
 */
export function mergePipelineDraft(
  stored: EntityAboutDocument | null,
  draft: EntityAboutDocument,
  now: string,
): EntityAboutDocument {
  const base = stored ?? EMPTY_ABOUT_DOCUMENT;
  const personSections = base.sections.filter((s) => s.writtenBy === "person");
  const personFactIds = new Set(
    personSections.flatMap((section) => [
      ...section.sentences.flatMap((sentence) => sentence.factIds),
      ...(section.eraEventId ? [eventFactId(section.eraEventId)] : []),
    ]),
  );
  const keptEvents = base.events.filter(
    (event) =>
      event.writtenBy === "person" ||
      !event.citations.length ||
      personFactIds.has(eventFactId(event.id)),
  );
  // Each kept event takes at most one draft event's citations.
  const matches = new Map<number, number>();
  for (const event of draft.events) {
    const kept = keptEvents.find(
      (candidate) =>
        ![...matches.values()].includes(candidate.id) &&
        sameEvent(candidate, event),
    );
    if (kept) matches.set(event.id, kept.id);
  }
  const draftEvents = draft.events
    .filter((event) => !matches.has(event.id))
    .map((event) => ({
      ...event,
      writtenBy: "pipeline" as const,
      createdAt: event.createdAt ?? now,
      updatedAt: now,
    }));

  const keptOnly: EntityAboutDocument = { ...base, events: keptEvents };
  const absorbed = absorbSourcesAndEvents(keptOnly, draft, draftEvents);
  const { sources, maps } = absorbed;
  const remapCitation = (citation: AboutCitation) => ({
    ...citation,
    sourceId: maps.sources.get(citation.sourceId) ?? citation.sourceId,
  });

  const events = absorbed.events.map((event) => {
    const added = draft.events
      .filter((candidate) => matches.get(candidate.id) === event.id)
      .flatMap((candidate) => candidate.citations.map(remapCitation))
      .filter(
        (citation) =>
          !event.citations.some((c) => c.sourceId === citation.sourceId),
      );
    if (!added.length) return event;
    return {
      ...event,
      citations: [...event.citations, ...added],
      updatedAt: now,
    };
  });
  for (const [draftId, keptId] of matches) maps.events.set(draftId, keptId);

  const siteFacts: EntityAboutDocument["siteFacts"] = {};
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const before = base.siteFacts[field];
    const proposed = draft.siteFacts[field];
    if (
      before &&
      (before.writtenBy === "person" ||
        (!proposed && personFactIds.has(siteFactId(field))))
    ) {
      siteFacts[field] = before;
    } else if (proposed) {
      siteFacts[field] = {
        ...proposed,
        writtenBy: "pipeline",
        citations: proposed.citations.map(remapCitation),
      };
    }
  }

  const personSectionKeys = new Set(personSections.map((s) => s.key));
  const draftSections = draft.sections
    .filter((section) => !personSectionKeys.has(section.key))
    .map((section) => ({
      ...section,
      writtenBy: "pipeline" as const,
      eraEventId: section.eraEventId
        ? (maps.events.get(section.eraEventId) ?? section.eraEventId)
        : null,
      sentences: section.sentences.map((sentence) => ({
        ...sentence,
        factIds: sentence.factIds.map((id) => remapFactId(id, maps)),
      })),
    }));

  return pruneSources({
    sources,
    events,
    siteFacts,
    sections: [...personSections, ...draftSections],
  });
}

/**
 * Entity merge rule (owner: `mergeEntity`): the destination absorbs the
 * merged Entity's events, site facts it lacks, and sources. The destination's
 * sections stay; the merged Entity's sections live on in change history.
 */
export function mergeEntityAboutDocuments(
  destination: EntityAboutDocument | null,
  merged: EntityAboutDocument,
): EntityAboutDocument {
  const base = destination ?? EMPTY_ABOUT_DOCUMENT;
  const { sources, events, maps } = absorbSourcesAndEvents(
    base,
    merged,
    merged.events,
  );
  const siteFacts: EntityAboutDocument["siteFacts"] = { ...base.siteFacts };
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = merged.siteFacts[field];
    if (siteFacts[field] || !fact) continue;
    siteFacts[field] = {
      ...fact,
      citations: fact.citations.map((citation) => ({
        ...citation,
        sourceId: maps.sources.get(citation.sourceId) ?? citation.sourceId,
      })),
    };
  }
  return pruneSources({
    sources,
    events,
    siteFacts,
    sections: base.sections,
  });
}
