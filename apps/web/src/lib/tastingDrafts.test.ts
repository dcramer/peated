import { ORPCError } from "@orpc/client";
import type { Bottle, User } from "@peated/server/types";
import { describe, expect, it, vi } from "vitest";

import {
  buildTastingDraftSaveInput,
  describeTastingDraft,
  getExistingBottleConflictId,
  getIdentificationPollInterval,
  getTastingDraftBottleHref,
  getTastingDraftPhotoChange,
  getTastingDraftSuggestion,
  parseTastingDraftId,
  postTastingDraft,
  type TastingDraft,
} from "./tastingDrafts";

const timestamp = "2026-10-18T20:00:00.000Z";
const emptyBands = {
  mediocre: 0,
  good: 0,
  very_good: 0,
  outstanding: 0,
  unicorn: 0,
};

const bottle: Bottle = {
  id: 7,
  peatedId: "B0007",
  fullName: "Ardbeg 10-year-old",
  name: "10-year-old",
  group: undefined,
  brand: {
    id: 1,
    peatedId: "E0001",
    name: "Ardbeg",
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
  edition: null,
  category: "single_malt",
  statedAge: 10,
  abv: 46,
  vintageYear: null,
  bottlingYear: null,
  releaseYear: null,
  releaseMonth: null,
  releaseDay: null,
  singleCask: false,
  caskStrength: false,
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
  reviewScoreBandCounts: emptyBands,
  tastingBandCounts: emptyBands,
  totalTastings: 0,
  publicReviewAndTastingCount: 0,
  notedReviewAndTastingCount: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  isFavorite: false,
  isLibrary: false,
  hasTasted: false,
};

const friend: User = {
  id: 3,
  username: "friend",
  pictureUrl: null,
  private: false,
};

type ProposedBottle = Extract<
  NonNullable<TastingDraft["identification"]["result"]>,
  { action: "create_bottle" }
>["proposedBottle"];

const proposedBottle: ProposedBottle = {
  name: "Wee Beastie",
  brand: { id: 1, name: "Ardbeg" },
  series: null,
  category: "single_malt",
  edition: null,
  statedAge: 5,
  abv: 47.4,
  caskStrength: null,
  singleCask: null,
  maturation: null,
  caskNumber: null,
  outturn: null,
  vintageYear: null,
  releaseYear: null,
  distillers: [],
  bottler: null,
};

function makeDraft(overrides: Partial<TastingDraft> = {}): TastingDraft {
  return {
    id: "0b7e4f1c-8c51-4a8b-9a3c-0a2c7c0c3a11",
    tastedAt: "2026-10-18T20:00:00.000Z",
    bottleHint: "the smoky one",
    bottle: null,
    imageUrl: "https://example.com/draft.jpg",
    identification: { status: "pending", result: null },
    notes: "Peat and lemon.",
    ratingBand: "very_good",
    tags: ["smoke"],
    servingStyle: "neat",
    color: 5,
    friends: [friend],
    createdAt: "2026-10-18T20:00:00.000Z",
    updatedAt: "2026-10-18T20:00:00.000Z",
    ...overrides,
  };
}

describe("getTastingDraftSuggestion", () => {
  it("reads each identification state", () => {
    expect(
      getTastingDraftSuggestion(
        makeDraft({ identification: { status: "none", result: null } }),
      ),
    ).toEqual({ kind: "none" });
    expect(getTastingDraftSuggestion(makeDraft())).toEqual({
      kind: "identifying",
    });
    expect(
      getTastingDraftSuggestion(
        makeDraft({
          identification: {
            status: "done",
            result: { action: "match", bottle },
          },
        }),
      ),
    ).toEqual({ kind: "match", bottle });
    expect(
      getTastingDraftSuggestion(
        makeDraft({
          identification: {
            status: "done",
            result: { action: "create_bottle", proposedBottle },
          },
        }),
      ),
    ).toEqual({ kind: "proposal", name: "Ardbeg Wee Beastie" });
  });

  it("asks for a search when the photo could not be identified", () => {
    for (const identification of [
      { status: "done", result: { action: "no_match" } },
      { status: "failed", result: null },
    ] as const) {
      expect(getTastingDraftSuggestion(makeDraft({ identification }))).toEqual({
        kind: "unknown",
      });
    }
  });
});

describe("getIdentificationPollInterval", () => {
  it("checks often at first, then slows down", () => {
    const draft = makeDraft({ bottle });

    expect(getIdentificationPollInterval(draft, 0)).toBe(5_000);
    expect(getIdentificationPollInterval(draft, 3 * 60_000)).toBe(60_000);
  });

  it("stops once identification is settled", () => {
    expect(
      getIdentificationPollInterval(
        makeDraft({ identification: { status: "failed", result: null } }),
        0,
      ),
    ).toBe(false);
    expect(getIdentificationPollInterval(undefined, 0)).toBe(false);
  });
});

describe("describeTastingDraft", () => {
  it("names a draft by its chosen Bottle", () => {
    expect(describeTastingDraft(makeDraft({ bottle }))).toEqual({
      name: "Ardbeg 10-year-old",
      status: "Bottle chosen",
    });
  });

  it("names a draft by its hint and shows the suggestion", () => {
    expect(
      describeTastingDraft(
        makeDraft({
          identification: {
            status: "done",
            result: { action: "match", bottle },
          },
        }),
      ),
    ).toEqual({
      name: "the smoky one",
      status: "Looks like Ardbeg 10-year-old",
    });
  });

  it("leaves the name empty when there is no Bottle or hint", () => {
    expect(
      describeTastingDraft(
        makeDraft({
          bottleHint: null,
          imageUrl: null,
          identification: { status: "none", result: null },
        }),
      ),
    ).toEqual({ name: null, status: "Needs a bottle" });
  });
});

describe("buildTastingDraftSaveInput", () => {
  it("repeats every field so a save does not clear any", () => {
    const input = buildTastingDraftSaveInput(makeDraft({ bottle }));

    expect(input).toEqual({
      draft: "0b7e4f1c-8c51-4a8b-9a3c-0a2c7c0c3a11",
      tastedAt: "2026-10-18T20:00:00.000Z",
      bottleHint: "the smoky one",
      bottle: 7,
      notes: "Peat and lemon.",
      ratingBand: "very_good",
      tags: ["smoke"],
      servingStyle: "neat",
      color: 5,
      friends: [3],
    });
    // Leaving the photo out keeps it.
    expect(input).not.toHaveProperty("pendingImageId");
  });

  it("applies changes on top of the draft", () => {
    expect(
      buildTastingDraftSaveInput(makeDraft(), {
        bottle: 9,
        notes: null,
        pendingImageId: null,
      }),
    ).toMatchObject({ bottle: 9, notes: null, pendingImageId: null });
  });
});

describe("getTastingDraftPhotoChange", () => {
  it("uploads only a photo that has not been saved", () => {
    const photo = { name: "photo" };

    expect(getTastingDraftPhotoChange(undefined, undefined)).toBe("keep");
    expect(getTastingDraftPhotoChange(photo, undefined)).toBe("replace");
    expect(getTastingDraftPhotoChange(photo, photo)).toBe("keep");
    expect(getTastingDraftPhotoChange(null, photo)).toBe("remove");
    expect(getTastingDraftPhotoChange(null, null)).toBe("keep");
  });
});

describe("getExistingBottleConflictId", () => {
  it("returns the Bottle Peated already has", () => {
    expect(
      getExistingBottleConflictId(
        new ORPCError("CONFLICT", { defined: true, data: { bottle: 12 } }),
      ),
    ).toBe(12);
  });

  it("ignores other errors", () => {
    expect(
      getExistingBottleConflictId(
        new ORPCError("BAD_REQUEST", { defined: true, data: { bottle: 12 } }),
      ),
    ).toBeNull();
    expect(
      getExistingBottleConflictId(new ORPCError("CONFLICT", { defined: true })),
    ).toBeNull();
  });
});

describe("postTastingDraft", () => {
  it("saves the details, then posts", async () => {
    const calls: string[] = [];
    const result = await postTastingDraft({
      save: async () => {
        calls.push("save");
      },
      publish: async () => {
        calls.push("publish");
        return { tasting: 5 };
      },
    });

    expect(calls).toEqual(["save", "publish"]);
    expect(result).toEqual({ tasting: 5 });
  });

  it("posts again when an earlier post went through", async () => {
    const publish = vi.fn(async () => ({ tasting: 5 }));

    await expect(
      postTastingDraft({
        save: async () => {
          throw new ORPCError("CONFLICT", {
            defined: true,
            data: { tasting: 5 },
          });
        },
        publish,
      }),
    ).resolves.toEqual({ tasting: 5 });
    expect(publish).toHaveBeenCalledOnce();
  });

  it("does not post when the save fails", async () => {
    const publish = vi.fn(async () => ({ tasting: 5 }));
    const error = new ORPCError("BAD_REQUEST", { defined: true });

    await expect(
      postTastingDraft({
        save: async () => {
          throw error;
        },
        publish,
      }),
    ).rejects.toBe(error);
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("parseTastingDraftId", () => {
  it("accepts only a draft UUID", () => {
    const draftId = "5f0c6b8e-3c1d-4a5e-9b7f-2d4e6a8c0b1d";
    expect(parseTastingDraftId(draftId)).toBe(draftId);
    expect(parseTastingDraftId("../admin")).toBeNull();
    expect(parseTastingDraftId("")).toBeNull();
    expect(parseTastingDraftId(null)).toBeNull();
  });
});

describe("getTastingDraftBottleHref", () => {
  it("returns to the draft's confirm step with the chosen Bottle", () => {
    const draftId = "5f0c6b8e-3c1d-4a5e-9b7f-2d4e6a8c0b1d";
    expect(getTastingDraftBottleHref({ id: draftId }, 42)).toBe(
      `/drafts/${draftId}?bottle=42`,
    );
  });
});
