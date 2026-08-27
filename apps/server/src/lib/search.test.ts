import { describe, expect, it } from "vitest";
import { buildBottleSearchVector } from "./search";

describe("buildBottleSearchVector", () => {
  it("indexes a bottle's series as primary identity", () => {
    const vector = buildBottleSearchVector(
      {
        fullName: "Decadent Drinks Glenburgie 38-year-old",
        name: "Glenburgie 38-year-old",
        brandId: 1,
        createdByActorId: 1,
      },
      {
        name: "Decadent Drinks",
        kind: "bottler",
        createdByActorId: 1,
      },
      [],
      undefined,
      [],
      {
        name: "Whiskyland",
        fullName: "Decadent Drinks Whiskyland",
        brandId: 1,
        createdByActorId: 1,
      },
    );

    expect(vector).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "Whiskyland", weight: "A" }),
      ]),
    );
  });
});
