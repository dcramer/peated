import type {
  ExactCatalogTargetV1,
  GenericCatalogTargetV1,
} from "@peated/server/schemas";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import BottleGroupView from "./bottleGroupView";

vi.mock("@peated/web/components/paginationButtons", () => ({
  default: ({
    rel,
  }: {
    rel: { nextCursor: number | null; prevCursor: number | null };
  }) => <nav aria-label="Pagination">Next page: {rel.nextCursor}</nav>,
}));

vi.mock("@peated/web/components/collectionAction", () => ({
  default: ({ targetId, title }: { targetId: number; title: string }) => (
    <button data-target-id={targetId}>{title}</button>
  ),
}));

vi.mock("./groupModActions", () => ({
  default: ({
    groupId,
    totalBottles,
  }: {
    groupId: number;
    totalBottles: number;
  }) => (
    <button aria-label="Bottle group actions">
      Group {groupId} has {totalBottles} releases
    </button>
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
} satisfies GenericCatalogTargetV1["group"];

const target = {
  schemaVersion: 1,
  kind: "group",
  targetId: 100,
  group,
} satisfies GenericCatalogTargetV1;

const exactTarget = {
  schemaVersion: 1,
  kind: "bottle",
  targetId: 101,
  group,
  bottle: {
    schemaVersion: 1,
    id: 42,
    groupId: group.id,
    fullName: "Lagavulin 21 Cask 42",
    name: "21-year-old",
    brandId: group.brandId,
    bottlerId: null,
    distillerIds: group.distillerIds,
    category: "single_malt",
    seriesId: null,
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
    createdByActorId: 4,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
} satisfies ExactCatalogTargetV1;

describe("BottleGroupView", () => {
  it("keeps generic identity separate from independently complete Bottles", () => {
    const html = renderToStaticMarkup(
      <BottleGroupView
        target={target}
        bottleList={{
          results: [exactTarget],
          rel: { prevCursor: null, nextCursor: 2 },
        }}
      />,
    );

    expect(html).toContain("Lagavulin 18");
    expect(html).toContain("Exact release not specified");
    expect(html).toContain('aria-label="Bottle group actions"');
    expect(html).toContain("Group 8 has 2 releases");
    expect(html).toContain('data-target-id="100"');
    expect(html).toContain("Save release family to Library");
    expect(html).toContain('href="/addBottle?group=8&amp;intent=tasting"');
    expect(html).toContain("Log Tasting");
    expect(html).toContain("Shared group description.");
    expect(html).toContain('src="https://example.com/group.webp"');
    expect(html).toContain("Related releases</dt><dd");
    expect(html).toContain(">2</dd>");

    expect(html).toContain('href="/bottles/42"');
    expect(html).not.toContain('href="/bottles/999"');
    expect(html).toContain("Lagavulin 21 Cask 42");
    expect(html).toContain("21 years");
    expect(html).toContain("55.1% ABV");
    expect(html).toContain("2004 vintage");
    expect(html).toContain("2025 release");
    expect(html).toContain("Single cask");
    expect(html).toContain("Cask strength");
    expect(html).toContain("1st Fill Oloroso Hogshead cask");
    expect(html).toContain('src="https://example.com/exact.webp"');
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain("Next page: 2");
  });
});
