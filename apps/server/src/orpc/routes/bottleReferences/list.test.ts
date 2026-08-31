import { db } from "@peated/server/db";
import { bottleReferences } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottle-references", () => {
  test("lists canonical and alternate names by direct Bottle id", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Reference Route Brand" });
    const bottle = await fixtures.Bottle({
      name: "Reference Route Bottle",
      brandId: brand.id,
    });
    await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "Alternate Direct Name",
    });
    const moderator = await fixtures.User({ mod: true });

    const { results } = await routerClient.bottleReferences.list(
      { bottle: bottle.id },
      { context: { user: moderator } },
    );

    expect(results).toEqual([
      expect.objectContaining({
        name: "Alternate Direct Name",
        bottleId: bottle.id,
        isCanonical: false,
      }),
      expect.objectContaining({
        name: "Reference Route Brand Reference Route Bottle",
        bottleId: bottle.id,
        isCanonical: true,
      }),
    ]);
  });

  test("defines unresolved references by nullable Bottle id", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const actor = await getUserActor(await fixtures.User());
    await db.insert(bottleReferences).values([
      {
        name: "Unresolved Bottle Reference",
        bottleId: null,
        assignedByActorId: actor.id,
      },
      {
        name: "Assigned Bottle Reference",
        bottleId: bottle.id,
        assignedByActorId: actor.id,
      },
      {
        name: "Ignored Unresolved Reference",
        bottleId: null,
        ignored: true,
        assignedByActorId: actor.id,
      },
      {
        name: "Nullable Unresolved Reference",
        bottleId: null,
        ignored: null,
        assignedByActorId: actor.id,
      },
    ]);
    const moderator = await fixtures.User({ mod: true });

    const { results } = await routerClient.bottleReferences.list(
      { onlyUnknown: true },
      { context: { user: moderator } },
    );

    expect(results).toEqual(
      ["Nullable Unresolved Reference", "Unresolved Bottle Reference"].map(
        (name) => expect.objectContaining({ name, bottleId: null }),
      ),
    );
  });

  test("supports query filtering and pagination", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "Paged Reference Alpha",
    });
    await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "Paged Reference Beta",
    });
    await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "Paged Reference Ignored",
      ignored: true,
    });
    const moderator = await fixtures.User({ mod: true });

    const first = await routerClient.bottleReferences.list(
      { query: "Paged Reference", limit: 1 },
      { context: { user: moderator } },
    );
    const second = await routerClient.bottleReferences.list(
      { query: "Paged Reference", limit: 1, cursor: 2 },
      { context: { user: moderator } },
    );

    expect(first.results).toHaveLength(1);
    expect(first.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(second.results).toHaveLength(1);
    expect(second.rel).toEqual({ nextCursor: null, prevCursor: 1 });
    expect(
      [...first.results, ...second.results].map(({ name }) => name),
    ).toEqual(["Paged Reference Alpha", "Paged Reference Beta"]);
  });

  test("rejects unknown Bottles", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });
    await expect(
      waitError(
        routerClient.bottleReferences.list(
          { bottle: 2_147_483_647 },
          { context: { user: moderator } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  test("rejects public reference reads", async ({ fixtures }) => {
    const user = await fixtures.User();
    await expect(
      waitError(routerClient.bottleReferences.list({}, { context: { user } })),
    ).resolves.toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
