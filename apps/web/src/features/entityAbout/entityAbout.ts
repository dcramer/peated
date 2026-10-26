import type { Outputs } from "@peated/server/orpc/router";

export type EntityAbout = NonNullable<Outputs["entities"]["about"]["details"]>;
export type AboutEvent = EntityAbout["events"][number];
export type AboutSection = NonNullable<EntityAbout["lead"]>;
export type YearCounts = Outputs["entities"]["about"]["vintages"];
export type RelatedCounts = Outputs["entities"]["about"]["bottlers"];

/** A span of years. A null end means it continues today. */
export type AboutSpan = {
  label: string;
  start: number;
  end: number | null;
};

export type VintageCount = { year: number; count: number };

// Display minimums (owner: docs/features/entity-about.md). A part below its
// minimum is hidden, with no heading or placeholder.
export const ABOUT_MIN_TIMELINE_SPANS = 2;
export const ABOUT_MIN_VINTAGE_BOTTLES = 10;
export const ABOUT_MIN_BOTTLERS = 3;
export const ABOUT_MIN_RELEASE_BOTTLES = 10;
export const ABOUT_MIN_KEY_FACTS = 2;

function year(date: string) {
  return Number(date.slice(0, 4));
}

const OPERATING_KINDS = new Set(["opened", "reopened"]);
const SILENT_KINDS = new Set(["closed", "mothballed"]);

/**
 * Turns opened, closed, mothballed, and reopened events into producing and
 * silent spans. Returns nothing until the first opening is known.
 */
export function getOperatingSpans(about: EntityAbout): AboutSpan[] {
  const changes = about.events.filter(
    (event) => OPERATING_KINDS.has(event.kind) || SILENT_KINDS.has(event.kind),
  );
  if (changes[0]?.kind !== "opened") return [];
  const spans: AboutSpan[] = [];
  for (const event of changes) {
    const label = OPERATING_KINDS.has(event.kind) ? "Producing" : "Silent";
    const last = spans.at(-1);
    if (last?.label === label) continue;
    if (last) last.end = year(event.date);
    spans.push({ label, start: year(event.date), end: null });
  }
  // Spans shorter than a year still mark the change on the timeline.
  return spans.filter((span) => span.end === null || span.end >= span.start);
}

/** Names over time, from an opening name and later renames. */
export function getNameSpans(about: EntityAbout, currentName: string) {
  const opened = about.events.find((event) => event.kind === "opened");
  const renames = about.events.filter((event) => event.kind === "renamed");
  if (!opened || !renames.length) return [];
  const spans: AboutSpan[] = [
    { label: opened.name ?? currentName, start: year(opened.date), end: null },
  ];
  for (const rename of renames) {
    spans.at(-1)!.end = year(rename.date);
    spans.push({
      label: rename.name ?? currentName,
      start: year(rename.date),
      end: null,
    });
  }
  return spans;
}

export type AboutOwner = AboutSpan & { entity: AboutEvent["newOwner"] };

/** Owners from acquisitions, newest first. */
export function getOwners(about: EntityAbout): AboutOwner[] {
  const acquisitions = about.events.filter(
    (event) => event.kind === "acquired",
  );
  return acquisitions
    .map((event, index) => ({
      label: event.newOwner?.name ?? event.newOwnerName ?? "Unknown owner",
      entity: event.newOwner,
      start: year(event.date),
      end: acquisitions[index + 1] ? year(acquisitions[index + 1]!.date) : null,
    }))
    .reverse();
}

export type AboutLinkedEntity = NonNullable<AboutEvent["relatedEntity"]>;
export type SentencePart = { text: string; entity: AboutLinkedEntity | null };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits a section's sentences so a mention of an Entity linked by one of the
 * sentence's cited events becomes a link. Display rule (owner:
 * docs/features/entity-about.md): only the Entity's exact current name as a
 * whole word counts, each Entity links once per section, and the page's own
 * Entity never links.
 */
export function linkEntityMentions(
  section: AboutSection,
  about: EntityAbout,
): SentencePart[][] {
  const events = new Map(about.events.map((event) => [event.id, event]));
  const linked = new Set<number>([about.entityId]);
  return section.sentences.map((sentence) => {
    const candidates = sentence.factIds
      .flatMap((factId) => {
        const event = factId.startsWith("event:")
          ? events.get(Number(factId.slice("event:".length)))
          : undefined;
        return [event?.relatedEntity, event?.newOwner];
      })
      .filter((entity): entity is AboutLinkedEntity => Boolean(entity))
      // Longer names first, so "Port Ellen Maltings" wins over "Port Ellen".
      .sort((a, b) => b.name.length - a.name.length);

    const matches: { start: number; end: number; entity: AboutLinkedEntity }[] =
      [];
    for (const entity of candidates) {
      if (linked.has(entity.id)) continue;
      const match = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(entity.name)}(?![\\p{L}\\p{N}])`,
        "u",
      ).exec(sentence.text);
      if (!match) continue;
      const start = match.index;
      const end = start + entity.name.length;
      if (matches.some((other) => start < other.end && other.start < end)) {
        continue;
      }
      matches.push({ start, end, entity });
      linked.add(entity.id);
    }

    const parts: SentencePart[] = [];
    let cursor = 0;
    for (const match of matches.sort((a, b) => a.start - b.start)) {
      if (match.start > cursor) {
        parts.push({
          text: sentence.text.slice(cursor, match.start),
          entity: null,
        });
      }
      parts.push({
        text: sentence.text.slice(match.start, match.end),
        entity: match.entity,
      });
      cursor = match.end;
    }
    if (cursor < sentence.text.length) {
      parts.push({ text: sentence.text.slice(cursor), entity: null });
    }
    return parts;
  });
}

export function getEras(about: EntityAbout): AboutSpan[] {
  return about.events.flatMap((event) =>
    event.kind === "era" && event.title
      ? [
          {
            label: event.title,
            start: year(event.date),
            end: event.endDate ? year(event.endDate) : null,
          },
        ]
      : [],
  );
}

export type AboutKeyFact = {
  label: string;
  value: string;
  sourceIds: string[];
};

/** Key facts for the sidebar: founding, first name, and site facts. */
export function getKeyFacts(
  about: EntityAbout,
  currentName: string,
): AboutKeyFact[] {
  const facts: AboutKeyFact[] = [];
  const opened = about.events.find((event) => event.kind === "opened");
  if (opened) {
    facts.push({
      label: "Founded",
      value: String(year(opened.date)),
      sourceIds: opened.citations.map((c) => c.sourceId),
    });
  }
  const names = getNameSpans(about, currentName);
  const firstName = names[0];
  if (firstName && firstName.label !== currentName) {
    facts.push({
      label: "First name",
      value: `${firstName.label}, until ${firstName.end}`,
      sourceIds: about.events
        .filter((event) => event.kind === "renamed")
        .flatMap((event) => event.citations.map((c) => c.sourceId)),
    });
  }
  for (const fact of about.siteFacts) {
    // Numbers are shown with thousands separators; text stays as written.
    const value = fact.value.toLocaleString("en-US");
    facts.push({
      label: fact.label,
      value: fact.unit ? `${value} ${fact.unit}` : value,
      sourceIds: fact.citations.map((c) => c.sourceId),
    });
  }
  return facts;
}

/** Numbers sources in the order the page first cites them. */
export function getCitationNumbers(
  about: EntityAbout,
  keyFacts: readonly AboutKeyFact[],
) {
  const numbers = new Map<string, number>();
  const cite = (ids: readonly string[]) => {
    for (const id of ids) {
      if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
    }
  };
  const sections = [about.lead, ...about.sections].filter(
    (section) => section !== null,
  );
  for (const section of sections) {
    for (const sentence of section.sentences) cite(sentence.sourceIds);
  }
  keyFacts.forEach((fact) => cite(fact.sourceIds));
  for (const event of about.events) {
    cite(event.citations.map((citation) => citation.sourceId));
  }
  return numbers;
}

/**
 * The years a chart axis labels: both ends, and every fifth year more than
 * two years from either end, so no two labels run together.
 */
export function getAxisYears(first: number, last: number): Set<number> {
  const years = new Set([first, last]);
  for (let year = Math.ceil(first / 5) * 5; year <= last; year += 5) {
    if (year - first > 2 && last - year > 2) years.add(year);
  }
  return new Set([...years].sort((a, b) => a - b));
}

const LABEL_EVERY_BAR_UP_TO = 12;
// Wider charts have columns too narrow on a phone for counts side by side.
const LABEL_EVERY_BAR_MAX_COLUMNS = 24;
const LABELED_PEAKS = 3;

/**
 * The years whose bar shows its count: every bar in a short, narrow chart,
 * otherwise the three tallest, so equal bars are never labeled at random.
 * `years` has one entry per column, empty years included.
 */
export function getLabeledYears(years: readonly VintageCount[]): Set<number> {
  const bars = years.filter((entry) => entry.count > 0);
  if (
    bars.length <= LABEL_EVERY_BAR_UP_TO &&
    years.length <= LABEL_EVERY_BAR_MAX_COLUMNS
  ) {
    return new Set(bars.map((entry) => entry.year));
  }
  return new Set(
    [...bars]
      .sort((a, b) => b.count - a.count)
      .slice(0, LABELED_PEAKS)
      .map((entry) => entry.year),
  );
}

/** Fills empty years between the first and last vintage so gaps show. */
export function fillYears(counts: YearCounts): VintageCount[] {
  if (!counts.results.length) return [];
  const byYear = new Map(counts.results.map((row) => [row.year, row.count]));
  const first = counts.results[0]!.year;
  const last = counts.results.at(-1)!.year;
  const years: VintageCount[] = [];
  for (let value = first; value <= last; value += 1) {
    years.push({ year: value, count: byYear.get(value) ?? 0 });
  }
  return years;
}

export function countWithYear(counts: YearCounts) {
  return counts.results.reduce((total, row) => total + row.count, 0);
}

/**
 * Era context for a Bottle distilled in `vintageYear`: the sourced era that
 * covers it, or the name the site used then when it differs from today's.
 */
export function getEraContext(
  about: EntityAbout,
  currentName: string,
  vintageYear: number,
) {
  const era = getEras(about).find(
    (span) =>
      vintageYear >= span.start &&
      (span.end === null || vintageYear <= span.end),
  );
  if (era) return { kind: "era" as const, span: era };
  const name = getNameSpans(about, currentName).find(
    (span) =>
      vintageYear >= span.start &&
      (span.end === null || vintageYear < span.end),
  );
  if (name && name.label !== currentName) {
    return { kind: "name" as const, span: name };
  }
  return null;
}
