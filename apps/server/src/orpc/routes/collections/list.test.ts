import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/collections", () => {
  test("requires authentication", async () => {
    const error = await waitError(() =>
      routerClient.collections.list({ user: "me" }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("rejects a private profile without friendship", async ({
    defaults,
    fixtures,
  }) => {
    const user = await fixtures.User({ private: true });

    const error = await waitError(() =>
      routerClient.collections.list(
        { user: user.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });

  test("filters collections by direct Bottle membership", async ({
    defaults,
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const other = await fixtures.Bottle();
    const matching = await fixtures.Collection({
      name: "Matching",
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    const excluded = await fixtures.Collection({
      name: "Excluded",
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    await db.insert(collectionBottles).values([
      { collectionId: matching.id, bottleId: selected.id },
      { collectionId: excluded.id, bottleId: other.id },
    ]);

    const response = await routerClient.collections.list(
      { user: "me", bottle: selected.id },
      { context: { user: defaults.user } },
    );

    expect(response.results.map(({ id }) => id)).toEqual([matching.id]);
  });

  test("rejects an unknown Bottle filter", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.collections.list(
        { user: "me", bottle: Number.MAX_SAFE_INTEGER },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });
});
