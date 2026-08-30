import { describe, expect, it } from "vitest";

import { getEntitySiblings } from "./entitySiblingData";

describe("getEntitySiblings", () => {
  it("removes the current entity", () => {
    expect(getEntitySiblings(1, { results: [{ id: 1 }, { id: 2 }] })).toEqual([
      { id: 2 },
    ]);
  });

  it("limits the rail to four related entities", () => {
    expect(
      getEntitySiblings(1, {
        results: [
          { id: 1 },
          { id: 2 },
          { id: 3 },
          { id: 4 },
          { id: 5 },
          { id: 6 },
        ],
      }),
    ).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
  });

  it("returns no siblings before data is available", () => {
    expect(getEntitySiblings(1)).toEqual([]);
  });
});
