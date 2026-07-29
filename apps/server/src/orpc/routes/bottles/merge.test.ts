import { db } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  type Bottle,
  type User,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

async function expectCommittedMerge({
  root,
  other,
  direction,
  mod,
}: {
  root: Bottle;
  other: Bottle;
  direction: "mergeInto" | "mergeFrom";
  mod: User;
}) {
  const source = direction === "mergeInto" ? root : other;
  const destination = direction === "mergeInto" ? other : root;
  const data = await routerClient.bottles.merge(
    { bottle: root.id, other: other.id, direction },
    { context: { user: mod } },
  );

  expect(data.id).toBe(destination.id);
  expect(data.fullName).toBe(destination.fullName);
  expect(
    await db.select().from(bottles).where(eq(bottles.id, source.id)),
  ).toEqual([]);
  expect(
    await db
      .select()
      .from(bottleTombstones)
      .where(eq(bottleTombstones.bottleId, source.id)),
  ).toEqual([expect.objectContaining({ newBottleId: destination.id })]);
}

describe("POST /bottles/:bottle/merge", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.bottles.merge(
        { bottle: 1, other: 2 },
        { context: { user: null } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false, admin: false });
    const err = await waitError(
      routerClient.bottles.merge(
        { bottle: 1, other: 2 },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("commits mergeInto before returning the destination", async ({
    fixtures,
  }) => {
    await expectCommittedMerge({
      root: await fixtures.Bottle({ name: "Root mergeInto" }),
      other: await fixtures.Bottle({ name: "Other mergeInto" }),
      direction: "mergeInto",
      mod: await fixtures.User({ mod: true }),
    });
  });

  test("commits mergeFrom before returning the destination", async ({
    fixtures,
  }) => {
    await expectCommittedMerge({
      root: await fixtures.Bottle({ name: "Root mergeFrom" }),
      other: await fixtures.Bottle({ name: "Other mergeFrom" }),
      direction: "mergeFrom",
      mod: await fixtures.User({ mod: true }),
    });
  });

  test("returns the committed destination on an identical retry", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Retry Source" });
    const destination = await fixtures.Bottle({ name: "Retry Destination" });
    const mod = await fixtures.User({ mod: true });
    const input = {
      bottle: source.id,
      other: destination.id,
      direction: "mergeInto" as const,
    };

    await routerClient.bottles.merge(input, { context: { user: mod } });
    const retry = await routerClient.bottles.merge(input, {
      context: { user: mod },
    });

    expect(retry.id).toBe(destination.id);
    expect(retry.fullName).toBe(destination.fullName);
  });

  test("maps invalid, missing, and invalid-graph merges", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Error Mapping" });
    const legacy = await fixtures.LegacyBottle({ name: "Unmigrated" });

    await expect(
      routerClient.bottles.merge(
        { bottle: bottle.id, other: bottle.id },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      routerClient.bottles.merge(
        { bottle: 999999, other: bottle.id },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      routerClient.bottles.merge(
        { bottle: legacy.id, other: bottle.id },
        { context: { user: mod } },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
