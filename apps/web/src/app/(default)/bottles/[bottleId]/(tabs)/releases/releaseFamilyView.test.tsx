import type { BottleGroupV1 } from "@peated/server/schemas";
import type { Bottle, Entity } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReleaseFamilyContent } from "./releaseFamilyView";

const timestamp = "2026-07-22T12:00:00.000Z";
const group = {
  schemaVersion: 1,
  id: 8,
  fullName: "Lagavulin 18",
  name: "18-year-old",
  brandId: 7,
  bottlerId: null,
  distillerIds: [7],
  category: "single_malt",
  seriesId: null,
  statedAge: 18,
  representativeBottleId: 999,
  flavorProfile: "peated",
  medianScore: 87,
  minScore: 80,
  maxScore: 95,
  memberScoreCount: 18,
  externalScoreCount: 2,
  scoreCount: 20,
  tastingBandCounts: {
    mediocre: 0,
    good: 1,
    very_good: 2,
    outstanding: 3,
    unicorn: 1,
  },
  totalTastings: 12,
  totalBottles: 2,
  createdByActorId: 4,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies BottleGroupV1;

const brand = {
  id: group.brandId,
  peatedId: "E0007",
  name: "Lagavulin",
  shortName: null,
  kind: "brand",
  ownerId: null,
  description: null,
  descriptionSrc: null,
  yearEstablished: null,
  website: null,
  country: null,
  region: null,
  address: null,
  location: null,
  totalTastings: 12,
  totalBottles: 2,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Entity;

const bottle = {
  id: 42,
  peatedId: "B0042",
  fullName: "Lagavulin 21 Cask 42",
  name: "21-year-old",
  group,
  series: null,
  category: "single_malt",
  flavorProfile: "peated",
  edition: "Cask 42",
  statedAge: 21,
  abv: 55.1,
  singleCask: true,
  caskStrength: true,
  naturalColor: true,
  nonChillFiltered: true,
  maltPhenolPpm: 101.4,
  noAgeStatement: null,
  vintageYear: 2004,
  bottlingYear: null,
  releaseYear: 2025,
  releaseDate: null,
  caskNumber: "#5678",
  maturation: "Oloroso hogshead",
  outturn: 240,
  brand,
  distillers: [brand],
  bottler: null,
  description: "Exact Bottle description.",
  descriptionSrc: "user",
  imageUrl: "https://example.com/exact.webp",
  tastingNotes: null,
  suggestedTags: [],
  medianScore: 91,
  minScore: 80,
  maxScore: 99,
  memberScoreCount: 20,
  externalScoreCount: 0,
  scoreCount: 20,
  tastingBandCounts: {
    mediocre: 0,
    good: 0,
    very_good: 0,
    outstanding: 1,
    unicorn: 0,
  },
  totalTastings: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  isFavorite: false,
  isLibrary: false,
  hasTasted: false,
} satisfies Bottle;

describe("ReleaseFamilyView", () => {
  it("presents releases without group activity or management actions", () => {
    const html = renderToStaticMarkup(
      <ReleaseFamilyContent
        bottleList={{
          results: [bottle],
          rel: { prevCursor: null, nextCursor: 2 },
        }}
        currentBottleId={bottle.id}
        pagination={
          <nav aria-label="Release pagination">cursor next page: 2</nav>
        }
      />,
    );

    expect(html).toContain('id="releases-heading"');
    expect(html).not.toContain("Release statistics");
    expect(html).not.toContain("Combined ratings");
    expect(html).not.toContain("Exact release not specified");
    expect(html).not.toContain("Release family");
    expect(html).not.toContain("Save");
    expect(html).not.toContain("Log Tasting");
    expect(html).not.toContain("/releases/merge");
    expect(html).not.toContain("/releases/split");
    expect(html).not.toContain("/addBottle?group=");

    expect(html).toContain('href="/bottles/42"');
    expect(html).toContain("Cask 42");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('title="Currently viewing"');
    expect(html).not.toContain(">Viewing<");
    expect(html).toContain("21 years");
    expect(html).toContain("55.1% ABV");
    expect(html).not.toContain("2004 vintage");
    expect(html).not.toContain("2025 release");
    expect(html).not.toContain("Single cask");
    expect(html).not.toContain("Cask strength");
    expect(html).not.toContain("1st Fill Oloroso Hogshead cask");
    expect(html).toContain("91 points");
    expect(html).not.toContain("1 tasting");
    expect(html).toContain('src="https://example.com/exact.webp"');
    expect(html).toContain('aria-label="Release pagination"');
    expect(html).toContain("cursor next page: 2");
  });

  it("describes an empty result as an empty release list", () => {
    const html = renderToStaticMarkup(
      <ReleaseFamilyContent
        bottleList={{
          results: [],
          rel: { prevCursor: null, nextCursor: null },
        }}
        currentBottleId={bottle.id}
      />,
    );

    expect(html).toContain("No releases found.");
  });
});
