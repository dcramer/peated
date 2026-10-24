import {
  mockBottle,
  mockCollectionBottle,
} from "@peated/server/orpc/mock/fixtures";
import { describe, expect, test } from "vitest";

import { getLibraryItem } from "./libraryItems";

describe("getLibraryItem", () => {
  test("names the status and links to the Bottle", () => {
    const item = getLibraryItem({ ...mockCollectionBottle, status: "sealed" });

    expect(item).toMatchObject({
      href: expect.stringMatching(/^\/bottles\//),
      id: String(mockCollectionBottle.id),
      name: "Lagavulin 16-year-old",
      status: "Sealed",
    });
    expect(
      getLibraryItem({ ...mockCollectionBottle, status: null }).status,
    ).toBeUndefined();
  });

  test("leads the table facts with the category and leaves out ABV", () => {
    const item = getLibraryItem({
      ...mockCollectionBottle,
      bottle: {
        ...mockBottle,
        abv: 43,
        category: "single_malt",
        edition: "Feis Ile 2024",
      },
    });

    expect(item.facts).toBe("Single Malt · Feis Ile 2024");
  });

  test("leaves out the viewer's in-Library and tasted marks", () => {
    const item = getLibraryItem({
      ...mockCollectionBottle,
      bottle: { ...mockBottle, hasTasted: true, isLibrary: true },
    });

    expect(item).toMatchObject({ hasTasted: false, isLibrary: false });
  });

  test("covers the frame with the member's photo and keeps catalog art whole", () => {
    const photo = getLibraryItem({
      ...mockCollectionBottle,
      imageUrl: "https://example.com/photo.jpg",
    });
    const catalog = getLibraryItem({
      ...mockCollectionBottle,
      imageUrl: null,
      bottle: { ...mockBottle, imageUrl: "https://example.com/bottle.png" },
    });

    expect(photo).toMatchObject({
      imageFit: "cover",
      imageUrl: "https://example.com/photo.jpg",
    });
    expect(catalog).toMatchObject({
      imageFit: "contain",
      imageUrl: "https://example.com/bottle.png",
    });
  });
});
