import type { BottleGroupV1 } from "@peated/server/schemas";
import type { Bottle, Entity } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ReleaseFamilyView from "./releaseFamilyView";

vi.mock("@peated/web/components/paginationButtons", () => ({
  default: ({
    rel,
    cursorParam,
    ariaLabel = "Pagination",
  }: {
    rel: { nextCursor: number | null; prevCursor: number | null };
    cursorParam?: string;
    ariaLabel?: string;
  }) => (
    <nav aria-label={ariaLabel}>
      {cursorParam ?? "cursor"} next page: {rel.nextCursor}
    </nav>
  ),
}));

const timestamp = "2026-07-22T12:00:00.000Z";
const ratingStats = {
  pass: 1,
  sip: 2,
  savor: 3,
  total: 6,
  avg: 1.25,
  percentage: { pass: 16.7, sip: 33.3, savor: 50 },
};

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
  description: "Shared group description.",
  descriptionSrc: "user",
  imageUrl: "https://example.com/group.webp",
  flavorProfile: "peated",
  tastingNotes: null,
  suggestedTags: [],
  avgRating: 1.25,
  ratingStats,
  totalTastings: 12,
  totalBottles: 2,
  createdByActorId: 4,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies BottleGroupV1;

const brand = {
  id: group.brandId,
  name: "Lagavulin",
  shortName: null,
  type: ["brand", "distiller"],
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
  vintageYear: 2004,
  releaseYear: 2025,
  caskSize: "hogshead",
  caskType: "oloroso",
  caskFill: "1st_fill",
  brand,
  distillers: [brand],
  bottler: null,
  description: "Exact Bottle description.",
  descriptionSrc: "user",
  imageUrl: "https://example.com/exact.webp",
  tastingNotes: null,
  suggestedTags: [],
  avgRating: 2,
  ratingStats: {
    pass: 0,
    sip: 0,
    savor: 1,
    total: 1,
    avg: 2,
    percentage: { pass: 0, sip: 0, savor: 100 },
  },
  totalTastings: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  isFavorite: false,
  isLibrary: false,
  hasTasted: false,
} satisfies Bottle;

describe("ReleaseFamilyView", () => {
  it("presents similar bottles without group activity or management actions", () => {
    const html = renderToStaticMarkup(
      <ReleaseFamilyView
        group={group}
        bottleList={{
          results: [bottle],
          rel: { prevCursor: null, nextCursor: 2 },
        }}
      />,
    );

    expect(html).toContain("Lagavulin 18");
    expect(html).toContain("Similar bottles");
    expect(html).toContain("Other releases");
    expect(html).toContain("Shared group description.");
    expect(html).toContain('src="https://example.com/group.webp"');
    expect(html).toContain("Similar bottles</dt><dd");
    expect(html).toContain(">2</dd>");
    expect(html).not.toContain("Exact release not specified");
    expect(html).not.toContain("Release family");
    expect(html).not.toContain("Save");
    expect(html).not.toContain("Log Tasting");
    expect(html).not.toContain("/releases/merge");
    expect(html).not.toContain("/releases/split");
    expect(html).not.toContain("/addBottle?group=");

    expect(html).toContain('href="/bottles/42"');
    expect(html).toContain("Lagavulin 21 Cask 42");
    expect(html).toContain("21 years");
    expect(html).toContain("55.1% ABV");
    expect(html).toContain("2004 vintage");
    expect(html).toContain("2025 release");
    expect(html).toContain("Single cask");
    expect(html).toContain("Cask strength");
    expect(html).toContain("1st Fill Oloroso Hogshead cask");
    expect(html).toContain('src="https://example.com/exact.webp"');
    expect(html).toContain('aria-label="Other release pagination"');
    expect(html).toContain("cursor next page: 2");
  });
});
