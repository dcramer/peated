import { db } from "@peated/server/db";
import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { createPostgresClient, waitForSessionBlockedBy } from "./testUtils";

const EMBEDDING = Array.from({ length: 3072 }, () => 0.125);

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
}));

describe("DELETE /bottle-aliases/:alias", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset();
  });

  test("atomically unassigns one direct Bottle and its matching consumers", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Alias Owner" });
    const otherBottle = await fixtures.Bottle({ name: "Other Alias Owner" });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Direct Bottle Alias",
    });
    const matchingReview = await fixtures.Review({
      bottleId: bottle.id,
      name: alias.name,
      issue: "direct-owner",
    });
    const matchingPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: alias.name,
      volume: 750,
    });
    const otherReview = await fixtures.Review({
      bottleId: otherBottle.id,
      name: alias.name,
      issue: "other-owner",
    });
    const otherPrice = await fixtures.StorePrice({
      bottleId: otherBottle.id,
      name: alias.name,
      volume: 700,
    });

    await expect(
      routerClient.bottleAliases.delete(
        { alias: alias.name.toUpperCase() },
        { context: { user } },
      ),
    ).resolves.toEqual({});

    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).resolves.toMatchObject({ bottleId: null });
    await expect(
      db.query.reviews.findFirst({
        where: eq(reviews.id, matchingReview.id),
      }),
    ).resolves.toMatchObject({ bottleId: null });
    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, matchingPrice.id),
      }),
    ).resolves.toMatchObject({ bottleId: null });
    await expect(
      db.query.reviews.findFirst({ where: eq(reviews.id, otherReview.id) }),
    ).resolves.toMatchObject({ bottleId: otherBottle.id });
    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, otherPrice.id),
      }),
    ).resolves.toMatchObject({ bottleId: otherBottle.id });
    expect(workerClient.pushJob).toHaveBeenCalledTimes(2);
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias.name,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("protects the direct Bottle canonical name", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Canonical Alias Bottle" });

    const error = await waitError(
      routerClient.bottleAliases.delete(
        { alias: bottle.fullName },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Cannot delete canonical name]`,
    );
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, bottle.fullName),
      }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("rejects an unresolved alias", async ({ fixtures }) => {
    const actor = await getUserActor(await fixtures.User());
    const [alias] = await db
      .insert(bottleAliases)
      .values({
        bottleId: null,
        name: "Unresolved Delete Alias",
        assignedByActorId: actor.id,
      })
      .returning();
    const user = await fixtures.User({ mod: true });

    const error = await waitError(
      routerClient.bottleAliases.delete(
        { alias: alias!.name },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Bottle Alias is not assigned to a Bottle.]`,
    );
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias!.name),
      }),
    ).resolves.toMatchObject({ bottleId: null });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("rolls back consumer clears when the alias changes concurrently", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Concurrent Alias Bottle" });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      ignored: false,
      name: "Concurrent Delete Alias",
    });
    const review = await fixtures.Review({
      bottleId: bottle.id,
      name: alias.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: alias.name,
    });
    const client = createPostgresClient();
    let committed = false;
    let deletion:
      | ReturnType<typeof routerClient.bottleAliases.delete>
      | undefined;
    let error: unknown;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `UPDATE "bottle" SET "updated_at" = "updated_at" WHERE "id" = $1`,
        [bottle.id],
      );

      deletion = routerClient.bottleAliases.delete(
        { alias: alias.name },
        { context: { user } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query(
        `UPDATE "bottle_alias" SET "ignored" = true WHERE "name" = $1`,
        [alias.name],
      );
      await client.query("COMMIT");
      committed = true;
      error = await waitError(deletion);
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await deletion?.catch(() => undefined);
    }

    expect(error).toMatchInlineSnapshot(
      `[Error: Bottle Alias changed while it was being unassigned. Retry the operation.]`,
    );
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).resolves.toMatchObject({
      bottleId: bottle.id,
      ignored: true,
    });
    await expect(
      db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
    await expect(
      db.query.storePrices.findFirst({ where: eq(storePrices.id, price.id) }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("commits the unassignment when indexing is unavailable", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Queue Failure Alias",
      embedding: EMBEDDING,
    });
    vi.mocked(workerClient.pushJob).mockRejectedValue(
      new Error("Queue unavailable"),
    );

    await expect(
      routerClient.bottleAliases.delete(
        { alias: alias.name },
        { context: { user } },
      ),
    ).resolves.toEqual({});
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).resolves.toMatchObject({ bottleId: null, embedding: null });
    expect(workerClient.pushJob).toHaveBeenCalledTimes(2);
  });

  test("returns not found for an unknown alias", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    await expect(
      waitError(
        routerClient.bottleAliases.delete(
          { alias: "Missing Bottle Alias" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Bottle Alias not found.]`);
  });

  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });

    await expect(
      waitError(
        routerClient.bottleAliases.delete(
          { alias: alias.name },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
