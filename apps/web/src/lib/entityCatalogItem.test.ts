import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import { describe, expect, it } from "vitest";

import {
  getEntityReviewAndTastingCount,
  toEntityCatalogItem,
} from "./entityCatalogItem";

describe("entity catalog items", () => {
  it("uses the combined public count", () => {
    expect(
      getEntityReviewAndTastingCount({
        publicReviewAndTastingCount: 18,
        totalTastings: 12,
      }),
    ).toBe(18);
  });

  it("uses the tasting count from an older response", () => {
    const { publicReviewAndTastingCount: _newCount, ...olderEntity } =
      mockEntity;

    expect(toEntityCatalogItem(olderEntity)).toMatchObject({
      publicReviewAndTastingCount: mockEntity.totalTastings,
    });
  });
});
