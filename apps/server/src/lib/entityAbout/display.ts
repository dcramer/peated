import type {
  AboutCitation,
  AboutSource,
  EntityAboutDocument,
  EntityAboutPublic,
} from "@peated/server/schemas/entityAbout";

import { ABOUT_FACT_FIELD_LIST, type AboutFactField } from "./aboutFactFields";

/**
 * Display rule (owner: docs/features/entity-about.md): a fact is shown only
 * when at least one citation points to a source that is not a retailer.
 * Uncited facts, including legacy history without a source, stay hidden.
 */
export function isFactShown(
  citations: readonly AboutCitation[],
  sources: readonly AboutSource[],
) {
  const kinds = new Map(sources.map((source) => [source.id, source.kind]));
  return citations.some((citation) => {
    const kind = kinds.get(citation.sourceId);
    return kind !== undefined && kind !== "retailer";
  });
}

function normalizeStatedValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Returns every stated value and its sources when citations disagree. */
export function getDisagreement(citations: readonly AboutCitation[]) {
  const byValue = new Map<string, { value: string; sourceIds: string[] }>();
  for (const citation of citations) {
    if (!citation.statedValue) continue;
    const key = normalizeStatedValue(citation.statedValue);
    const entry = byValue.get(key) ?? {
      value: citation.statedValue,
      sourceIds: [],
    };
    if (!entry.sourceIds.includes(citation.sourceId)) {
      entry.sourceIds.push(citation.sourceId);
    }
    byValue.set(key, entry);
  }
  // Values that differ only in precision, such as 1983 and 1983-03, agree.
  const keys = [...byValue.keys()];
  const conflicting = keys.some((left) =>
    keys.some(
      (right) =>
        left !== right && !left.startsWith(right) && !right.startsWith(left),
    ),
  );
  return conflicting ? { values: [...byValue.values()] } : null;
}

export function eventFactId(eventId: number) {
  return `event:${eventId}`;
}

export function siteFactId(field: AboutFactField) {
  return `site:${field}`;
}

/** Returns the citations behind every fact ID in the document. */
export function getFactCitations(document: EntityAboutDocument) {
  const facts = new Map<string, readonly AboutCitation[]>();
  for (const event of document.events) {
    facts.set(eventFactId(event.id), event.citations);
  }
  for (const field of ABOUT_FACT_FIELD_LIST) {
    const fact = document.siteFacts[field];
    if (fact) facts.set(siteFactId(field), fact.citations);
  }
  return facts;
}

/** Returns the IDs of facts that the display rule shows. */
export function getShownFactIds(document: EntityAboutDocument) {
  const shown = new Set<string>();
  for (const [factId, citations] of getFactCitations(document)) {
    if (isFactShown(citations, document.sources)) shown.add(factId);
  }
  return shown;
}

const TIMELINE_EVENT_KINDS = new Set([
  "opened",
  "closed",
  "mothballed",
  "reopened",
  "renamed",
  "era",
]);

/**
 * About tab rule (owner: docs/features/entity-about.md): the tab shows when
 * a published page has a lead and at least one more part from its document:
 * a section, a timeline of 2 or more dated periods or names, or 2 or more
 * key facts.
 */
export function hasEntityAboutPage(about: EntityAboutPublic | null) {
  if (!about?.lead) return false;
  const timelineEvents = about.events.filter((event) =>
    TIMELINE_EVENT_KINDS.has(event.kind),
  );
  return (
    about.sections.length > 0 ||
    timelineEvents.length >= 2 ||
    about.siteFacts.length >= 2
  );
}
