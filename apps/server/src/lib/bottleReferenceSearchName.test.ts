import { describe, expect, test } from "vitest";

import { stripReleaseIdentityFromSearchName } from "./bottleReferenceSearchName";

describe("stripReleaseIdentityFromSearchName", () => {
  test("strips bare annual release years from parent search names", () => {
    expect(
      stripReleaseIdentityFromSearchName(
        "Four Roses Limited Edition Small Batch 2017",
        {
          edition: null,
          releaseYear: 2017,
          statedAge: null,
          vintageYear: null,
        },
      ),
    ).toBe("Four Roses Limited Edition Small Batch");

    expect(
      stripReleaseIdentityFromSearchName(
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
      stripReleaseIdentityFromSearchName(
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
      stripReleaseIdentityFromSearchName(
        "Heaven's Door Bootleg Vol 3 Whiskey",
        {
          edition: "Vol. 3",
          releaseYear: null,
          statedAge: null,
          vintageYear: null,
        },
      ),
    ).toBe("Heaven's Door Bootleg Whiskey");
  });
});
