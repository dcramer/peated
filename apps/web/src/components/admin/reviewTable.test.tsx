import type { Bottle, Entity, Review } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReviewRows } from "./reviewTable";

const timestamp = "2026-07-22T12:00:00.000Z";

const brand = {
  id: 7,
  peatedId: "E0007",
  name: "Springbank",
  shortName: null,
  type: ["brand"],
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
  abv: 56.2,
  vintageYear: null,
  releaseYear: 2024,
  caskType: null,
  caskSize: null,
  caskFill: null,
  brand,
  distillers: [],
  bottler: null,
  description: null,
  descriptionSrc: null,
  imageUrl: null,
  flavorProfile: null,
  tastingNotes: null,
  suggestedTags: [],
  avgRating: null,
  avgScore: null,
  totalScores: 0,
  ratingStats: {
    pass: 0,
    sip: 0,
    savor: 0,
    total: 0,
    avg: null,
    percentage: { pass: 0, sip: 0, savor: 0 },
  },
  totalTastings: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  isFavorite: false,
  isLibrary: false,
  hasTasted: false,
} satisfies Bottle;

function makeReview(id: number, reviewBottle: Bottle | null): Review {
  return {
    id,
    name: "Springbank review",
    rating: 91,
    url: `https://example.com/reviews/${id}`,
    article: { title: null, publishedAt: null },
    reviewerName: null,
    nativeScore: null,
    summary: null,
    bottle: reviewBottle,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("ReviewTable", () => {
  it("renders the direct Bottle identity", () => {
    const html = renderToStaticMarkup(
      <ReviewRows reviewList={[makeReview(1, bottle)]} />,
    );

    expect(html).toContain('href="/bottles/19"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
  });

  it("renders unresolved review identity without a catalog link", () => {
    const html = renderToStaticMarkup(
      <ReviewRows reviewList={[makeReview(3, null)]} />,
    );

    expect(html).toContain("No Bottle");
    expect(html).not.toContain('href="/bottles/');
    expect(html).not.toContain("/releases");
  });
});
