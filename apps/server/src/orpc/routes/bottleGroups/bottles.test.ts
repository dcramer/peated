import { db } from "@peated/server/db";
import { bottleGroupTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

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
    const second = await fixtures.BottleGroupMember({
      groupId: first.groupId as number,
      edition: "Batch Azure",
      releaseYear: 2025,
      abv: 52.4,
    });

    const firstPage = await routerClient.bottleGroups.bottles({
      group: first.groupId as number,
      limit: 1,
      sort: "-releaseYear",
    });
    const secondPage = await routerClient.bottleGroups.bottles({
      group: first.groupId as number,
      cursor: 2,
      limit: 1,
      sort: "-releaseYear",
    });
    const search = await routerClient.bottleGroups.bottles({
      group: first.groupId as number,
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
    expect(firstPage.results[0]).not.toHaveProperty("targetId");
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

    expect(error.message).toBe("Bottle group not found (groupId=999999).");
  });

  test("preserves the replacement for a retired group", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Retired Related Bottles" });
    const destination = await fixtures.Bottle({
      name: "Active Related Bottles",
    });
    await db.insert(bottleGroupTombstones).values({
      groupId: source.groupId as number,
      newGroupId: destination.groupId as number,
      createdByActorId: source.createdByActorId,
    });

    const error = await waitError(
      routerClient.bottleGroups.bottles({
        group: source.groupId as number,
      }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `Bottle group is retired (groupId=${source.groupId}).`,
      data: {
        replacement: { kind: "group", groupId: destination.groupId },
      },
    });
  });
});
