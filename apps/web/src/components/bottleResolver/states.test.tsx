import type { Bottle } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PhotoIdentification } from "./helpers";
import { PhotoMatchCreateState } from "./states";

function makeBottle(overrides: Partial<Bottle> = {}): Bottle {
  const timestamp = "2026-08-23T00:00:00.000Z";
  return {
    id: 42,
    peatedId: "B0042",
    fullName: "Springbank 12-year-old Cask Strength Batch 24",
    name: "12-year-old Cask Strength Batch 24",
    group: undefined,
    brand: {
      id: 1,
      peatedId: "E0001",
      name: "Springbank",
      shortName: null,
      type: ["brand"],
      kind: null,
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
    },
    distillers: [],
    bottler: null,
    series: null,
    edition: "Batch 24",
    category: "single_malt",
    statedAge: 12,
    abv: 57.2,
    vintageYear: null,
    releaseYear: 2023,
    singleCask: false,
    caskStrength: true,
    naturalColor: null,
    nonChillFiltered: null,
    maltPhenolPpm: null,
    noAgeStatement: null,
    caskFill: null,
    caskType: null,
    caskSize: null,
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
    ...overrides,
  };
}

const result: PhotoIdentification = {
  pendingImage: {
    id: "pending-test",
    imageUrl: "https://example.com/test.jpg",
    expiresAt: "2026-08-23T00:00:00.000Z",
  },
  imageEvidence: {
    sourceImageId: "pending-test",
    extractors: [
      {
        kind: "vision",
        confidence: 1,
        textSpans: [],
        observations: [],
      },
    ],
    fieldCandidates: {},
    photoSuitability: {
      isSingleBottlePhoto: true,
      labelReadable: true,
      suitableAsTastingImage: true,
      suitableAsBottleImage: true,
    },
    conflicts: [],
  },
  classification: {
    status: "ignored",
    reason: "Test fixture",
    artifacts: { candidates: [] },
  },
  suggestedNextStep: "manual_search",
  diagnostics: {
    extraction: { status: "empty", summary: null },
    candidates: { count: 0 },
    classification: {
      status: "ignored",
      action: null,
      confidence: null,
      reason: "Test fixture",
    },
  },
  createToken: null,
};

function renderMatchedBottle(bottle: Bottle) {
  return renderToStaticMarkup(
    <PhotoMatchCreateState
      result={result}
      previewUrl={null}
      matchedBottle={bottle}
      createProposalLabel={null}
      hasCreateDecision={false}
      proposedName={null}
      createPending={false}
      createActionLabel="Create"
      resolvingAction={null}
      hasLibraryEntry={false}
      pendingImage={null}
      loadingExactLibraryStatus={false}
      onLoadBottle={vi.fn()}
      onAcceptCreateProposal={vi.fn()}
    />,
  );
}

describe("PhotoMatchCreateState", () => {
  it("shows the matched bottle release year alongside its edition", () => {
    const html = renderMatchedBottle(makeBottle());

    expect(html).toContain("Batch 24");
    expect(html).toContain("2023 release");
  });

  it("does not repeat a release year already expressed by the edition", () => {
    const html = renderMatchedBottle(makeBottle({ edition: "2023 Release" }));

    expect(html.match(/2023 release/gi)).toHaveLength(1);
  });
});
