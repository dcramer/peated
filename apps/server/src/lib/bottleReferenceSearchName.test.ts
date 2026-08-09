import { describe, expect, test } from "vitest";

import { stripBottleIdentityFromSearchName } from "./bottleReferenceSearchName";

describe("stripBottleIdentityFromSearchName", () => {
  test("strips bare annual release years from parent search names", () => {
    expect(
      stripBottleIdentityFromSearchName(
        "Example Limited Edition Small Batch 2017",
        {
          edition: null,
          releaseYear: 2017,
          statedAge: null,
          vintageYear: null,
        },
      ),
    ).toBe("Example Limited Edition Small Batch");

    expect(
      stripBottleIdentityFromSearchName(
        "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
        {
          edition: null,
          releaseYear: 2023,
          statedAge: null,
          vintageYear: null,
        },
      ),
    ).toBe("Lagavulin Distiller's Edition Islay Single Malt Scotch Whisky");
  });

  test("strips numbered edition markers with flexible punctuation", () => {
    expect(
      stripBottleIdentityFromSearchName(
        "Highland Park Cask Strength Release No. 5",
        {
          edition: "No. 5",
          releaseYear: null,
          statedAge: null,
          vintageYear: null,
        },
      ),
    ).toBe("Highland Park Cask Strength");

    expect(
      stripBottleIdentityFromSearchName("Heaven's Door Bootleg Vol 3 Whiskey", {
        edition: "Vol. 3",
        releaseYear: null,
        statedAge: null,
        vintageYear: null,
      }),
    ).toBe("Heaven's Door Bootleg Whiskey");
  });
});
