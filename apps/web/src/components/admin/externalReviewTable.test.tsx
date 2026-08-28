import type { Bottle, Entity, ExternalReview } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExternalReviewRows } from "./externalReviewTable";

const timestamp = "2026-07-22T12:00:00.000Z";

const brand = {
  id: 7,
  peatedId: "E0007",
  name: "Springbank",
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
  totalTastings: 0,
  totalBottles: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Entity;

const bottle = {
  id: 19,
  peatedId: "B0019",
  fullName: "Springbank 12 Cask Strength Batch 24",
  name: "12 Cask Strength Batch 24",
  series: null,
  category: "single_malt",
  edition: "Batch 24",
  statedAge: 12,
  caskStrength: true,
  singleCask: false,
  naturalColor: null,
  nonChillFiltered: null,
  maltPhenolPpm: null,
  noAgeStatement: null,
  abv: 56.2,
  vintageYear: null,
  bottlingYear: null,
  releaseYear: 2024,
  releaseDate: null,
  maturation: null,
  caskNumber: null,
  outturn: null,
  brand,
  distillers: [],
  bottler: null,
  description: null,
  descriptionSrc: null,
  imageUrl: null,
  flavorProfile: null,
  tastingNotes: null,
  suggestedTags: [],
  medianScore: null,
  minScore: null,
  maxScore: null,
  memberScoreCount: 0,
  externalScoreCount: 0,
  scoreCount: 0,
  tastingBandCounts: {
    mediocre: 0,
    good: 0,
    very_good: 0,
    outstanding: 0,
    unicorn: 0,
  },
  totalTastings: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  isFavorite: false,
  isLibrary: false,
  hasTasted: false,
} satisfies Bottle;

function makeExternalReview(
  id: number,
  reviewBottle: Bottle | null,
): ExternalReview {
  return {
    id,
    name: "Springbank review",
    url: `https://example.com/reviews/${id}`,
    article: { title: null, publishedAt: null },
    reviewerName: null,
    nativeScore: { value: 91, scale: 100, display: "91/100" },
    summary: null,
    bottle: reviewBottle,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("ExternalReviewTable", () => {
  it("renders the direct Bottle identity", () => {
    const html = renderToStaticMarkup(
      <ExternalReviewRows
        externalReviewList={[makeExternalReview(1, bottle)]}
      />,
    );

    expect(html).toContain('href="/bottles/19"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
  });

  it("renders unresolved review identity without a catalog link", () => {
    const html = renderToStaticMarkup(
      <ExternalReviewRows externalReviewList={[makeExternalReview(3, null)]} />,
    );

    expect(html).toContain("No Bottle");
    expect(html).not.toContain('href="/bottles/');
    expect(html).not.toContain("/releases");
  });
});
