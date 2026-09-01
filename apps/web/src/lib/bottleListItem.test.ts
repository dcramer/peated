import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import { describe, expect, test } from "vitest";

import { toBottleListItem } from "./bottleListItem";

describe("toBottleListItem", () => {
  test("separates the brand from the expression in standard bottle lists", () => {
    expect(toBottleListItem(mockBottle)).toMatchObject({
      brand: "Lagavulin",
      brandHref: "/brands/9201-lagavulin",
      name: "16-year-old",
    });
  });

  test("keeps the brand in the name when the brand row is disabled", () => {
    expect(
      toBottleListItem(mockBottle, { includeBrandRow: false }),
    ).toMatchObject({
      brand: undefined,
      brandHref: undefined,
      name: "Lagavulin 16-year-old",
    });
  });
});
