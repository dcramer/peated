import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottle-aliases", () => {
  test("lists canonical and alternate names by direct Bottle id", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Alias Route Brand" });
    const bottle = await fixtures.Bottle({
      name: "Alias Route Bottle",
      brandId: brand.id,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Alternate Direct Name",
    });

    const { results } = await routerClient.bottleAliases.list({
      bottle: bottle.id,
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: "Alias Route Brand Alias Route Bottle",
        bottleId: bottle.id,
        isCanonical: true,
      }),
      expect.objectContaining({
        name: "Alternate Direct Name",
        bottleId: bottle.id,
        isCanonical: false,
      }),
    ]);
  });

  test("defines unresolved aliases by nullable Bottle id", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const actor = await getUserActor(await fixtures.User());
    await db.insert(bottleAliases).values([
      {
        name: "Unresolved Bottle Alias",
        bottleId: null,
        assignedByActorId: actor.id,
      },
      {
        name: "Assigned Bottle Alias",
        bottleId: bottle.id,
        assignedByActorId: actor.id,
      },
      {
        name: "Ignored Unresolved Alias",
        bottleId: null,
        ignored: true,
        assignedByActorId: actor.id,
      },
      {
        name: "Nullable Unresolved Alias",
        bottleId: null,
        ignored: null,
        assignedByActorId: actor.id,
      },
    ]);

    const { results } = await routerClient.bottleAliases.list({
      onlyUnknown: true,
    });

    expect(results).toEqual(
      ["Nullable Unresolved Alias", "Unresolved Bottle Alias"].map((name) =>
        expect.objectContaining({ name, bottleId: null }),
      ),
    );
  });

  test("supports query filtering and pagination", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Paged Alias Alpha",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Paged Alias Beta",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Paged Alias Ignored",
      ignored: true,
    });

    const first = await routerClient.bottleAliases.list({
      query: "Paged Alias",
      limit: 1,
    });
    const second = await routerClient.bottleAliases.list({
      query: "Paged Alias",
      limit: 1,
      cursor: 2,
    });

    expect(first.results).toHaveLength(1);
    expect(first.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(second.results).toHaveLength(1);
    expect(second.rel).toEqual({ nextCursor: null, prevCursor: 1 });
    expect(
      [...first.results, ...second.results].map(({ name }) => name),
    ).toEqual(["Paged Alias Alpha", "Paged Alias Beta"]);
  });

  test("rejects unknown Bottles", async () => {
    await expect(
      waitError(routerClient.bottleAliases.list({ bottle: 2_147_483_647 })),
    ).resolves.toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });
});
