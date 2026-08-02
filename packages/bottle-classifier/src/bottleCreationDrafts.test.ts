import { describe, expect, test } from "vitest";
import { normalizeProposedBottleDraft } from "./bottleCreationDrafts";
import type { ProposedBottle } from "./classifierTypes";

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
    caskType: "oloroso",
    caskSize: "hogshead",
    caskFill: "1st_fill",
    abv: 55.1,
    vintageYear: 2014,
    releaseYear: 2024,
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

describe("normalizeProposedBottleDraft", () => {
  test("normalizes a complete Bottle draft without dropping exact fields", () => {
    expect(normalizeProposedBottleDraft(buildProposedBottle())).toMatchObject({
      name: "Private Selection 10-year-old",
      edition: "S2B13",
      statedAge: 10,
      caskStrength: true,
      singleCask: true,
      caskType: "oloroso",
      caskSize: "hogshead",
      caskFill: "1st_fill",
      abv: 55.1,
      vintageYear: 2014,
      releaseYear: 2024,
      distillers: [
        {
          id: 12,
          name: "Maker's Mark",
        },
      ],
      bottler: {
        id: 44,
        name: "Maker’s Mark",
      },
    });
  });

  test("moves explicit ABV out of the name and onto the Bottle", () => {
    expect(
      normalizeProposedBottleDraft({
        ...buildProposedBottle(),
        name: "Islay 2007 8-year-old 57.1% ABV",
        statedAge: 8,
        abv: null,
      }),
    ).toMatchObject({
      name: "Islay 2007 8-year-old",
      statedAge: 8,
      abv: 57.1,
    });
  });

  test("keeps structured ABV when removing duplicate name text", () => {
    expect(
      normalizeProposedBottleDraft({
        ...buildProposedBottle(),
        name: "Islay 2007 8-year-old (57.1%)",
        statedAge: 8,
        abv: 57.1,
      }),
    ).toMatchObject({
      name: "Islay 2007 8-year-old",
      statedAge: 8,
      abv: 57.1,
    });
  });

  test("keeps implausible bare percentages in Bottle names", () => {
    expect(
      normalizeProposedBottleDraft({
        ...buildProposedBottle(),
        name: "Rare 8% Rye",
        abv: null,
      }),
    ).toMatchObject({
      name: "Rare 8% Rye",
      abv: null,
    });
  });
});
