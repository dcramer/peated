import { describe, expect, it } from "vitest";

import { getEntitySiblings } from "./entitySiblingData";

describe("getEntitySiblings", () => {
  it("removes the current entity", () => {
    expect(
      getEntitySiblings(1, {
        results: [
          { id: 1, kind: "distillery" },
          { id: 2, kind: "bottler" },
        ],
      }),
    ).toEqual([{ id: 2, kind: "bottler" }]);
  });

  it("includes only distilleries and bottlers", () => {
    expect(
      getEntitySiblings(1, {
        results: [
          { id: 2, kind: "brand" },
          { id: 3, kind: "distillery" },
          { id: 4, kind: "company" },
          { id: 5, kind: "bottler" },
        ],
      }),
    ).toEqual([
      { id: 3, kind: "distillery" },
      { id: 5, kind: "bottler" },
    ]);
  });

  it("limits the rail to four related entities", () => {
    expect(
      getEntitySiblings(1, {
        results: [
          { id: 1, kind: "distillery" },
          { id: 2, kind: "distillery" },
          { id: 3, kind: "distillery" },
          { id: 4, kind: "distillery" },
          { id: 5, kind: "distillery" },
          { id: 6, kind: "distillery" },
        ],
      }),
    ).toEqual([
      { id: 2, kind: "distillery" },
      { id: 3, kind: "distillery" },
      { id: 4, kind: "distillery" },
      { id: 5, kind: "distillery" },
    ]);
  });

  it("returns no siblings before data is available", () => {
    expect(getEntitySiblings(1)).toEqual([]);
  });
});
