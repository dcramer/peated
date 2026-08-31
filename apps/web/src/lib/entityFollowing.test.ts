import { describe, expect, test } from "vitest";

import { filterFollowingEntities } from "./entityFollowing";

describe("filterFollowingEntities", () => {
  test("removes local unfollows from the rows and total", () => {
    const list = {
      results: [
        { id: 1, isFollowing: true },
        { id: 2, isFollowing: true },
      ],
      total: 8,
    };

    expect(filterFollowingEntities(list, (entity) => entity.id !== 2)).toEqual({
      results: [{ id: 1, isFollowing: true }],
      total: 7,
    });
  });

  test("preserves the server total when every result remains visible", () => {
    const list = {
      results: [{ id: 1, isFollowing: true }],
      total: 8,
    };

    expect(filterFollowingEntities(list, () => true)).toEqual(list);
  });
});
