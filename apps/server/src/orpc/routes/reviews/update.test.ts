import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleTombstones,
  incomingBottleDecisionLogs,
  reviews,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import { describe, expect, test } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  client: NodePgClient,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ blocked: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE $1 = ANY(pg_blocking_pids(pid))
      ) AS blocked`,
      [blockerPid],
    );
    if (result.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for review update lock.");
}

describe("PATCH /reviews/:review", () => {
  test("requires mod role", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });
    const review = await fixtures.Review();

    await expect(
      routerClient.reviews.update(
        { review: review.id, hidden: true },
        { context: { user } },
      ),
    ).rejects.toThrow("Unauthorized.");
  });

  test("hidden-only updates preserve Bottle identity", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const review = await fixtures.Review({
      bottleId: bottle.id,
      hidden: false,
    });

    const response = await routerClient.reviews.update(
      { review: review.id, hidden: true },
      { context: { user } },
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      hidden: true,
    });
    expect(response.bottle?.id).toBe(bottle.id);
  });

  test("assigns an independently valid Bottle", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const nextBottle = await fixtures.Bottle();
    const review = await fixtures.Review({
      bottleId: null,
    });

    const response = await routerClient.reviews.update(
      { review: review.id, bottle: nextBottle.id },
      { context: { user } },
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: nextBottle.id,
    });
    expect(response.bottle?.id).toBe(nextBottle.id);

    expect(
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: and(
          eq(incomingBottleDecisionLogs.sourceKind, "review"),
          eq(incomingBottleDecisionLogs.sourceId, review.id),
        ),
      }),
    ).toMatchObject({
      decision: "match_existing",
      bottleId: nextBottle.id,
    });
  });

  test("supports explicit unassignment", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const review = await fixtures.Review({
      bottleId: bottle.id,
    });

    const response = await routerClient.reviews.update(
      { review: review.id, bottle: null },
      { context: { user } },
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: null,
    });
    expect(response.bottle).toBeNull();
  });

  test("rejects a missing Bottle without partial updates", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review({ hidden: false });

    const error = await waitError(
      routerClient.reviews.update(
        { review: review.id, bottle: 999_999, hidden: true },
        { context: { user } },
      ),
    );
    expect(error.message).toBe("Bottle not found.");
  });

  test("rejects a retired Bottle without partial updates", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const retiredBottle = await fixtures.Bottle();
    const review = await fixtures.Review({ hidden: false });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: null,
    });

    const error = await waitError(
      routerClient.reviews.update(
        { review: review.id, bottle: retiredBottle.id, hidden: true },
        { context: { user } },
      ),
    );
    expect(error.message).toBe(`Bottle ${retiredBottle.id} is retired.`);
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: review.bottleId,
      hidden: false,
    });
  });

  test("rejects a group-less Bottle without partial updates", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const selectedBottle = await fixtures.LegacyBottle();
    const review = await fixtures.Review({ hidden: false });

    const error = await waitError(
      routerClient.reviews.update(
        { review: review.id, bottle: selectedBottle.id, hidden: true },
        { context: { user } },
      ),
    );
    expect(error.message).toBe(`Bottle ${selectedBottle.id} is not active.`);
  });

  test("hidden-only updates retain an identity changed while waiting for the Review", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const originalBottle = await fixtures.Bottle();
    const concurrentBottle = await fixtures.Bottle();
    const review = await fixtures.Review({
      bottleId: originalBottle.id,
      hidden: false,
    });
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let update: ReturnType<typeof routerClient.reviews.update> | undefined;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `UPDATE "review" SET "bottle_id" = $1 WHERE "id" = $2`,
        [concurrentBottle.id, review.id],
      );

      update = routerClient.reviews.update(
        { review: review.id, hidden: true },
        { context: { user } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;
      await update;
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await update?.catch(() => undefined);
    }

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: concurrentBottle.id,
      hidden: true,
    });
  });

  test("locks a selected Bottle before the Review", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const selectedBottle = await fixtures.Bottle();
    const concurrentBottle = await fixtures.Bottle();
    const review = await fixtures.Review({
      bottleId: null,
      hidden: false,
    });
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let update: ReturnType<typeof routerClient.reviews.update> | undefined;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `UPDATE "bottle" SET "updated_at" = "updated_at" WHERE "id" = $1`,
        [selectedBottle.id],
      );

      update = routerClient.reviews.update(
        { review: review.id, bottle: selectedBottle.id, hidden: true },
        { context: { user } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query(
        `UPDATE "review" SET "bottle_id" = $1 WHERE "id" = $2`,
        [concurrentBottle.id, review.id],
      );
      await client.query("COMMIT");
      committed = true;
      await update;
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await update?.catch(() => undefined);
    }

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: selectedBottle.id,
      hidden: true,
    });
  });

  test("returns NOT_FOUND for a nonexistent review", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    await expect(
      routerClient.reviews.update(
        { review: 999_999, hidden: true },
        { context: { user } },
      ),
    ).rejects.toThrow("Review not found.");
  });

  test("returns the existing Review when no changes are sent", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review();

    const response = await routerClient.reviews.update(
      { review: review.id },
      { context: { user } },
    );

    expect(response.id).toBe(review.id);
    expect(response.bottle?.id).toBe(review.bottleId);
  });
});
