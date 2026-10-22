import type { Bottle } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PhotoIdentification } from "./helpers";
import { PhotoFallbackState, PhotoMatchState } from "./states";

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
      pronunciation: null,
      pronunciationIpa: null,
      pronunciationAudioUrl: null,
      kind: "brand",
      status: null,
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
      publicReviewAndTastingCount: 0,
      totalBottles: 1,
      isFollowing: false,
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
    bottlingYear: null,
    releaseYear: 2023,
    releaseMonth: null,
    releaseDay: null,
    singleCask: false,
    caskStrength: true,
    naturalColor: null,
    nonChillFiltered: null,
    maltPhenolPpm: null,
    noAgeStatement: null,
    outturn: null,
    maturation: null,
    caskNumber: null,
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
    raterCount: 0,
    scoreCount: 0,
    reviewScoreBandCounts: {
      mediocre: 0,
      good: 0,
      very_good: 0,
      outstanding: 0,
      unicorn: 0,
    },
    tastingBandCounts: {
      mediocre: 0,
      good: 0,
      very_good: 0,
      outstanding: 0,
      unicorn: 0,
    },
    totalTastings: 0,
    publicReviewAndTastingCount: 0,
    notedReviewAndTastingCount: 0,
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
  wrongMatchToken: null,
};

function renderMatchedBottle(bottle: Bottle, onWrongMatch?: () => void) {
  return renderToStaticMarkup(
    <PhotoMatchState
      result={result}
      previewUrl={null}
      matchedBottle={bottle}
      resolvingAction={null}
      hasLibraryEntry={false}
      pendingImage={null}
      loadingExactLibraryStatus={false}
      onLoadBottle={vi.fn()}
      onWrongMatch={onWrongMatch}
    />,
  );
}

function renderFallback(
  props: Partial<Parameters<typeof PhotoFallbackState>[0]> = {},
) {
  return renderToStaticMarkup(
    <PhotoFallbackState
      result={result}
      previewUrl={null}
      reason="Thanks, we've noted the wrong match."
      suggestions={[]}
      onPickSuggestion={vi.fn()}
      createBottleHref="/bottles/new?name=Batch"
      searchHref="/search?q=Springbank"
      searchLabel="Search bottles"
      onStartOver={vi.fn()}
      {...props}
    />,
  );
}

describe("PhotoMatchState", () => {
  it("shows the matched bottle release year alongside its edition", () => {
    const html = renderMatchedBottle(makeBottle());

    expect(html).toContain("Batch 24");
    expect(html).toContain("2023 release");
  });

  it("offers a visible way out when the match is wrong", () => {
    const html = renderMatchedBottle(makeBottle(), vi.fn());

    expect(html).toContain("Not my bottle");
  });

  it("holds the match actions while the wrong-match report saves", () => {
    const renderActions = vi.fn(() => null);
    renderToStaticMarkup(
      <PhotoMatchState
        result={result}
        previewUrl={null}
        matchedBottle={makeBottle()}
        renderMatchedResultActions={renderActions}
        resolvingAction={null}
        hasLibraryEntry={false}
        pendingImage={null}
        loadingExactLibraryStatus={false}
        onLoadBottle={vi.fn()}
        reportingWrongMatch
        onWrongMatch={vi.fn()}
      />,
    );

    expect(renderActions).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true }),
    );
  });
});

describe("PhotoFallbackState", () => {
  it("suggests Bottles that continue with the chosen one", () => {
    const html = renderFallback({
      suggestions: [
        makeBottle({ id: 7, fullName: "Springbank 10-year-old" }),
        makeBottle({ id: 8, fullName: "Springbank 15-year-old" }),
      ],
    });

    expect(html).toContain("Thanks, we&#x27;ve noted the wrong match.");
    expect(html).toContain("Is it one of these?");
    expect(html).toContain("Use this bottle: Springbank 10-year-old");
    expect(html).toContain("Use this bottle: Springbank 15-year-old");
    // Adding a new Bottle stays available after the suggestions.
    expect(html).toContain('href="/bottles/new?name=Batch"');
  });

  it("leaves out the suggestion list when there is nothing to suggest", () => {
    const html = renderFallback();

    expect(html).not.toContain("Is it one of these?");
    expect(html).toContain('href="/search?q=Springbank"');
  });

  it("adds an approved new Bottle through its own actions", () => {
    const html = renderFallback({
      result: {
        ...result,
        imageEvidence: {
          ...result.imageEvidence,
          fieldCandidates: {
            brand: { value: "Springbank", confidence: 0.9 },
          },
        },
      },
      proposal: {
        name: "Springbank 12-year-old Batch 25",
        actions: <button type="button">Add a bottle</button>,
      },
    });

    expect(html).toContain("Springbank 12-year-old Batch 25");
    expect(html).toContain("Add a bottle");
    // One tap adds it, so the label facts are shown, not collapsed.
    expect(html).toMatch(/Brand.*Springbank/);
    expect(html).not.toContain("Label details");
    // The proposal replaces the blank Add a new bottle form.
    expect(html).not.toContain("/bottles/new?name=Batch");
  });
});
