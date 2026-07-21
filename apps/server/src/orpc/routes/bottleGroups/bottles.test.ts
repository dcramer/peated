import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottle-groups/:group/bottles", () => {
  test("lists independently complete exact Bottles with search, sort, and pagination", async ({
    fixtures,
    defaults,
  }) => {
    const first = await fixtures.Bottle({
      name: "Batch Expression",
      edition: "Batch Amber",
      releaseYear: 2020,
      abv: 46,
    });
    const second = await createConcreteBottle({
      context: { user: defaults.user },
      input: {
        kind: "source_bottle",
        sourceBottleId: first.id,
        exact: {
          edition: "Batch Azure",
          releaseYear: 2025,
          abv: 52.4,
        },
      },
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
      kind: "bottle",
      group: { id: first.groupId },
      bottle: {
        id: second.bottle.id,
        groupId: first.groupId,
        edition: "Batch Azure",
        releaseYear: 2025,
        abv: 52.4,
      },
    });
    expect(firstPage.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(secondPage.results[0].bottle).toMatchObject({
      id: first.id,
      edition: "Batch Amber",
      releaseYear: 2020,
      abv: 46,
    });
    expect(secondPage.rel).toEqual({ nextCursor: null, prevCursor: 1 });
    expect(search.results.map(({ bottle }) => bottle.id)).toEqual([
      second.bottle.id,
    ]);
  });

  test("returns not found rather than an empty page for an unknown group", async () => {
    const error = await waitError(
      routerClient.bottleGroups.bottles({ group: 999_999 }),
    );

    expect(error.message).toBe("Catalog target not found (groupId=999999).");
  });
});
