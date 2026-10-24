import { mockBottle, mockTasting } from "@peated/server/orpc/mock/fixtures";
import { describe, expect, test } from "vitest";

import { getTastingTableItems } from "./tastingTable";

describe("getTastingTableItems", () => {
  test("links each row to its tasting and keeps the bottle's name and ABV", () => {
    const [item] = getTastingTableItems([mockTasting]);

    expect(item).toMatchObject({
      abv: "43%",
      href: `/tastings/${mockTasting.id}-lagavulin-16-year-old`,
      id: String(mockTasting.id),
      name: "Lagavulin 16-year-old",
      ratingBand: "outstanding",
      tastedAt: mockTasting.tastedAt,
    });
  });

  test("collapses a note to one line and omits an empty note", () => {
    const [multiline, blank] = getTastingTableItems([
      { ...mockTasting, notes: "  Smoke,\n\nbrine,   and lemon.  " },
      { ...mockTasting, id: 2, notes: "  \n " },
    ]);

    expect(multiline?.note).toBe("Smoke, brine, and lemon.");
    expect(blank?.note).toBeUndefined();
  });

  test("covers the frame with a tasting photo and keeps catalog art whole", () => {
    const [photo, catalog] = getTastingTableItems([
      { ...mockTasting, imageUrl: "https://example.com/photo.jpg" },
      {
        ...mockTasting,
        id: 2,
        imageUrl: null,
        bottle: { ...mockBottle, imageUrl: "https://example.com/bottle.png" },
      },
    ]);

    expect(photo).toMatchObject({
      imageFit: "cover",
      imageUrl: "https://example.com/photo.jpg",
    });
    expect(catalog).toMatchObject({
      imageFit: "contain",
      imageUrl: "https://example.com/bottle.png",
    });
  });

  test("leaves ABV and rating empty when they are unknown", () => {
    const [item] = getTastingTableItems([
      {
        ...mockTasting,
        bottle: { ...mockBottle, abv: null },
        ratingBand: null,
      },
    ]);

    expect(item).toMatchObject({ abv: null, ratingBand: null });
  });
});
