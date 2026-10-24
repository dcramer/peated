import type {
  AboutCitation,
  AboutSource,
  EntityAboutDocument,
  EntityAboutPublic,
} from "@peated/server/schemas/entityAbout";

import { ABOUT_FACT_FIELD_LIST, type AboutFactField } from "./aboutFactFields";

/**
 * Display rule (owner: docs/features/entity-about.md): a fact is shown only
 * when at least one citation points to a source in the document.
 */
export function isFactShown(
  citations: readonly AboutCitation[],
  sources: readonly AboutSource[],
) {
  const ids = new Set(sources.map((source) => source.id));
  return citations.some((citation) => ids.has(citation.sourceId));
}

function normalizeStatedValue(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      // "500,000" and "500000" are the same number.
      .replace(/(\d),(?=\d{3}\b)/g, "$1")
  );
}

export const ISO_DATE_PATTERN = /^\d{4}(?:-\d{2}){0,2}$/;

const DATE_RANGE_PATTERN =
  /^(\d{4}(?:-\d{2}){0,2}) ?[–-] ?(\d{4}(?:-\d{2}){0,2})$/;

/** Reads a date or a range such as `1969–1973` as a start and an end. */
function parseDates(value: string) {
  if (ISO_DATE_PATTERN.test(value)) return { start: value, end: null };
  const range = DATE_RANGE_PATTERN.exec(value);
  return range ? { start: range[1]!, end: range[2]! } : null;
}

function datesAgree(left: string, right: string) {
  return left.startsWith(right) || right.startsWith(left);
}

/**
 * Dates that differ only in precision, such as 1983 and 1983-03, agree.
 * Ranges agree when their starts and ends do; a single date is compared
 * with a range's start. Other values agree only when they are the same:
 * 2 stills is not 20.
 */
export function valuesAgree(left: string, right: string) {
  const a = normalizeStatedValue(left);
  const b = normalizeStatedValue(right);
  const datesA = parseDates(a);
  const datesB = parseDates(b);
  if (datesA && datesB) {
    return (
      datesAgree(datesA.start, datesB.start) &&
      (!datesA.end || !datesB.end || datesAgree(datesA.end, datesB.end))
    );
  }
  return a === b;
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
  const keys = [...byValue.keys()];
  const conflicting = keys.some((left) =>
    keys.some((right) => !valuesAgree(left, right)),
  );
  return conflicting ? { values: [...byValue.values()] } : null;
}

/**
 * The disagreement on an event's date. A source may state a name or text
 * for an event instead of a date; only dates and ranges can disagree with
 * the stored date.
 */
export function getDateDisagreement(citations: readonly AboutCitation[]) {
  return getDisagreement(
    citations.filter(
      (citation) =>
        citation.statedValue &&
        parseDates(normalizeStatedValue(citation.statedValue)),
    ),
  );
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
