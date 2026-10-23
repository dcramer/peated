import { broraAbout } from "./articles/brora";

/** A published source the About article cites. */
export type AboutSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
};

/** One paragraph and the sources that support every claim in it. */
export type AboutParagraph = {
  text: string;
  sources: readonly string[];
};

/**
 * A fact the sources do not agree on. The article states the best-supported
 * value and shows this note beside it with every source.
 */
export type AboutDisagreement = {
  topic: string;
  text: string;
  sources: readonly string[];
};

export type AboutSection = {
  id: string;
  heading: string;
  years?: string;
  paragraphs: readonly AboutParagraph[];
  disagreements?: readonly AboutDisagreement[];
  subsections?: readonly AboutSection[];
};

/** A span of years. A null end means it continues today. */
export type AboutSpan = {
  label: string;
  start: number;
  end: number | null;
};

export type AboutFact = {
  label: string;
  value: string;
  entityId?: number;
  sources: readonly string[];
};

export type EntityAbout = {
  entityId: number;
  reviewedOn: string;
  lead: AboutParagraph;
  facts: readonly AboutFact[];
  operating: readonly AboutSpan[];
  names: readonly AboutSpan[];
  owners: readonly (AboutSpan & { entityId?: number })[];
  peatedYears?: AboutSpan;
  sections: readonly AboutSection[];
  sources: readonly AboutSource[];
};

// Proof of concept: articles live in code until Peated stores them.
const articles = new Map<number, EntityAbout>([
  [broraAbout.entityId, broraAbout],
]);

export function getEntityAbout(entityId: number) {
  return articles.get(entityId) ?? null;
}

/** Numbers sources in the order the article first cites them. */
export function getCitationNumbers(article: EntityAbout) {
  const numbers = new Map<string, number>();
  const cite = (ids: readonly string[]) => {
    for (const id of ids) {
      if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
    }
  };
  const visit = (section: AboutSection) => {
    section.paragraphs.forEach((paragraph) => cite(paragraph.sources));
    section.disagreements?.forEach((note) => cite(note.sources));
    section.subsections?.forEach(visit);
  };

  cite(article.lead.sources);
  article.facts.forEach((fact) => cite(fact.sources));
  article.sections.forEach(visit);
  return numbers;
}

export type VintageCount = { year: number; count: number };

/**
 * Counts Bottles by vintage year and fills empty years between the first and
 * last vintage so gaps stay visible.
 */
export function getVintageCounts(
  bottles: readonly { vintageYear: number | null }[],
) {
  const counts = new Map<number, number>();
  let withoutVintage = 0;
  for (const bottle of bottles) {
    if (bottle.vintageYear === null) {
      withoutVintage += 1;
      continue;
    }
    counts.set(bottle.vintageYear, (counts.get(bottle.vintageYear) ?? 0) + 1);
  }

  const years = [...counts.keys()];
  if (!years.length) return { years: [], withoutVintage };

  const first = Math.min(...years);
  const last = Math.max(...years);
  const result: VintageCount[] = [];
  for (let year = first; year <= last; year += 1) {
    result.push({ year, count: counts.get(year) ?? 0 });
  }
  return { years: result, withoutVintage };
}
