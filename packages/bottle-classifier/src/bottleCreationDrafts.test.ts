import { describe, expect, test } from "vitest";
import type { ProposedBottle } from "./classifierTypes";

import {
  inferBottleCreationTarget,
  normalizeBottleCreationDrafts,
  normalizeProposedBottleDraft,
  splitProposedBottleReleaseDraft,
} from "./bottleCreationDrafts";

function buildProposedBottle(): ProposedBottle {
  return {
    name: "Maker's Mark Private Selection 10 yr",
    series: {
      id: null,
      name: "Private Selection",
    },
    category: "bourbon",
    edition: "S2B13",
    statedAge: 10,
    caskStrength: true,
    singleCask: true,
    abv: 55.1,
    vintageYear: 2014,
    releaseYear: 2024,
    caskType: "bourbon",
    caskSize: "barrel",
    caskFill: "1st_fill",
    brand: {
      id: null,
      name: "Maker's Mark",
    },
    distillers: [
      {
        id: null,
        name: "Maker’s Mark",
      },
      {
        id: 12,
        name: "Maker's Mark",
      },
    ],
    bottler: {
      id: 44,
      name: "Maker’s Mark",
    },
  };
}

describe("splitProposedBottleReleaseDraft", () => {
  test("normalizes proposed bottle drafts before splitting release fields", () => {
    expect(normalizeProposedBottleDraft(buildProposedBottle())).toMatchObject({
      name: "Private Selection 10-year-old",
      statedAge: 10,
      distillers: [
        {
          id: 12,
          name: "Maker's Mark",
        },
      ],
      bottler: null,
    });
  });

  test("infers creation targets from the populated draft sides", () => {
    expect(
      inferBottleCreationTarget({
        bottle: { name: "Bottle" },
        release: { edition: "Batch 1" },
      }),
    ).toBe("bottle_and_release");
    expect(
      inferBottleCreationTarget({
        bottle: { name: "Bottle" },
      }),
    ).toBe("bottle");
    expect(
      inferBottleCreationTarget({
        release: { edition: "Batch 1" },
      }),
    ).toBe("release");
    expect(inferBottleCreationTarget({})).toBeNull();
  });

  test("moves release-only fields off the bottle draft", () => {
    const { proposedBottle, proposedRelease } = splitProposedBottleReleaseDraft(
      {
        proposedBottle: {
          name: "Private Selection S2B13",
          series: {
            id: null,
            name: "Private Selection",
          },
          category: "bourbon",
          edition: "S2B13",
          statedAge: 10,
          caskStrength: true,
          singleCask: true,
          abv: 55.1,
          vintageYear: 2014,
          releaseYear: 2024,
          caskType: "bourbon",
          caskSize: "barrel",
          caskFill: "1st_fill",
          brand: {
            id: null,
            name: "Maker's Mark",
          },
          distillers: [
            {
              id: null,
              name: "Maker's Mark",
            },
          ],
          bottler: null,
        },
      },
    );

    expect(proposedBottle).toMatchObject({
      name: "Private Selection S2B13",
      statedAge: 10,
      edition: null,
      caskStrength: null,
      singleCask: null,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
    });
    expect(proposedRelease).toMatchObject({
      edition: "S2B13",
      statedAge: null,
      caskStrength: true,
      singleCask: true,
      abv: 55.1,
      vintageYear: 2014,
      releaseYear: 2024,
      caskType: "bourbon",
      caskSize: "barrel",
      caskFill: "1st_fill",
    });
  });

  test("keeps an explicit release age even when it is the only release detail", () => {
    const { proposedBottle, proposedRelease } = splitProposedBottleReleaseDraft(
      {
        proposedBottle: {
          name: "Macallan 18",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: 18,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: null,
            name: "Macallan",
          },
          distillers: [
            {
              id: null,
              name: "Macallan",
            },
          ],
          bottler: null,
        },
        proposedRelease: {
          edition: null,
          statedAge: 12,
          abv: null,
          caskStrength: null,
          singleCask: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          description: null,
          tastingNotes: null,
          imageUrl: null,
        },
      },
    );

    expect(proposedBottle.statedAge).toBe(18);
    expect(proposedRelease).toMatchObject({
      statedAge: 12,
    });
  });

  test("normalizes creation drafts according to the requested target", () => {
    const bottleOnly = normalizeBottleCreationDrafts({
      creationTarget: "bottle",
      proposedBottle: buildProposedBottle(),
    });
    expect(bottleOnly).toMatchObject({
      creationTarget: "bottle",
      proposedBottle: {
        name: "Private Selection 10-year-old",
      },
      proposedRelease: null,
    });

    const releaseOnly = normalizeBottleCreationDrafts({
      creationTarget: "release",
      proposedBottle: buildProposedBottle(),
    });
    expect(releaseOnly).toMatchObject({
      creationTarget: "release",
      proposedBottle: null,
      proposedRelease: {
        edition: "S2B13",
      },
    });

    const inferred = normalizeBottleCreationDrafts({
      creationTarget: "bottle_and_release",
      proposedBottle: buildProposedBottle(),
    });
    expect(inferred).toMatchObject({
      creationTarget: "bottle_and_release",
      proposedBottle: {
        name: "Private Selection 10-year-old",
      },
      proposedRelease: {
        edition: "S2B13",
      },
    });
  });
});
