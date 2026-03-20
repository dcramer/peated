import { describe, expect, test } from "vitest";

import { splitProposedBottleReleaseDraft } from "@peated/server/lib/priceMatchingDraftNormalization";

describe("splitProposedBottleReleaseDraft", () => {
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
});
