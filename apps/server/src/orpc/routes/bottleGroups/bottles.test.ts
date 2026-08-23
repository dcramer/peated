import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

function requireGroupId(groupId: number | null): number {
  if (groupId === null) throw new Error("Missing BottleGroup fixture");
  return groupId;
}

describe("GET /bottle-groups/:group/bottles", () => {
  test("lists independently complete exact Bottles with search, sort, and pagination", async ({
    fixtures,
  }) => {
    const first = await fixtures.Bottle({
      name: "Batch Expression",
      edition: "Batch Amber",
      releaseYear: 2020,
      abv: 46,
    });
    const groupId = requireGroupId(first.groupId);
    const second = await fixtures.BottleGroupMember({
      groupId,
      edition: "Batch Azure",
      releaseYear: 2025,
      abv: 52.4,
    });

    const firstPage = await routerClient.bottleGroups.bottles({
      group: groupId,
      limit: 1,
      sort: "-releaseYear",
    });
    const secondPage = await routerClient.bottleGroups.bottles({
      group: groupId,
      cursor: 2,
      limit: 1,
      sort: "-releaseYear",
    });
    const search = await routerClient.bottleGroups.bottles({
      group: groupId,
      query: "Azure",
      sort: "name",
    });

    expect(firstPage.results).toHaveLength(1);
    expect(firstPage.results[0]).toMatchObject({
      id: second.id,
      group: { id: first.groupId },
      edition: "Batch Azure",
      releaseYear: 2025,
      abv: 52.4,
    });
    expect(firstPage.results[0]).not.toHaveProperty("kind");
    expect(firstPage.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(secondPage.results[0]).toMatchObject({
      id: first.id,
      edition: "Batch Amber",
      releaseYear: 2020,
      abv: 46,
    });
    expect(secondPage.rel).toEqual({ nextCursor: null, prevCursor: 1 });
    expect(search.results.map(({ id }) => id)).toEqual([second.id]);
  });

  test("returns not found rather than an empty page for an unknown group", async () => {
    const error = await waitError(
      routerClient.bottleGroups.bottles({ group: 999_999 }),
    );

    expect(error.message).toBe("Bottle Group not found (groupId=999999).");
  });
});
