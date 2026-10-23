import { describe, expect, it } from "vitest";

import { broraAbout } from "./articles/brora";
import {
  getCitationNumbers,
  getVintageCounts,
  type AboutSection,
  type AboutSpan,
  type EntityAbout,
} from "./entityAbout";

function getCitedIds(about: EntityAbout) {
  const ids: string[] = [...about.lead.sources];
  const visit = (section: AboutSection) => {
    section.paragraphs.forEach((paragraph) => ids.push(...paragraph.sources));
    section.disagreements?.forEach((note) => ids.push(...note.sources));
    section.subsections?.forEach(visit);
  };
  about.facts.forEach((fact) => ids.push(...fact.sources));
  about.sections.forEach(visit);
  return ids;
}

/** Returns each place where a span does not start as the previous one ends. */
function getSpanBreaks(spans: readonly AboutSpan[]) {
  const breaks = spans.flatMap((span, index) => {
    const next = spans[index + 1];
    return next && next.start !== span.end
      ? [`${span.label}→${next.label}`]
      : [];
  });
  if (spans.at(-1)?.end !== null) breaks.push("last span ends before today");
  return breaks;
}

describe("getVintageCounts", () => {
  it("counts bottles by vintage and keeps empty years between them", () => {
    expect(
      getVintageCounts([
        { vintageYear: 1972 },
        { vintageYear: 1970 },
        { vintageYear: 1972 },
        { vintageYear: null },
      ]),
    ).toEqual({
      years: [
        { year: 1970, count: 1 },
        { year: 1971, count: 0 },
        { year: 1972, count: 2 },
      ],
      withoutVintage: 1,
    });
  });

  it("returns no years when no bottle has a vintage", () => {
    expect(getVintageCounts([{ vintageYear: null }])).toEqual({
      years: [],
      withoutVintage: 1,
    });
  });
});

describe("getCitationNumbers", () => {
  it("numbers sources in the order the article first cites them", () => {
    const numbers = getCitationNumbers({
      ...broraAbout,
      lead: { text: "Lead.", sources: ["b", "a"] },
      facts: [{ label: "Founded", value: "1819", sources: ["a", "c"] }],
      sections: [],
    });

    expect([...numbers]).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 3],
    ]);
  });
});

describe("Brora About article", () => {
  // Evidence rule: every claim cites a listed source, and every listed source
  // supports at least one claim.
  it("cites only listed sources and lists only cited sources", () => {
    const cited = new Set(getCitedIds(broraAbout));
    const listed = new Set(broraAbout.sources.map((source) => source.id));

    expect([...cited].filter((id) => !listed.has(id))).toEqual([]);
    expect([...listed].filter((id) => !cited.has(id))).toEqual([]);
  });

  it("describes every year from founding to today without gaps", () => {
    expect(getSpanBreaks(broraAbout.operating)).toEqual([]);
    expect(getSpanBreaks(broraAbout.names)).toEqual([]);
    expect(getSpanBreaks(broraAbout.owners)).toEqual([]);
  });
});
