import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /bottles/{bottle}/target", () => {
  test("returns the active exact target anonymously", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      name: "Target Lookup",
      edition: "Batch 2",
    });

    const result = await routerClient.bottles.target({ bottle: bottle.id });

    expect(result).toMatchObject({
      schemaVersion: 1,
      kind: "bottle",
      group: { id: bottle.groupId },
      bottle: {
        id: bottle.id,
        fullName: bottle.fullName,
        edition: "Batch 2",
      },
    });
    expect(result.targetId).toBeGreaterThan(0);
  });

  test.each([{ bottle: 0 }, { bottle: -1 }, { bottle: 1.5 }])(
    "rejects an invalid Bottle id: %o",
    async (input) => {
      const error = await waitError(routerClient.bottles.target(input));
      expect(error).toMatchObject({ status: 400 });
    },
  );

  test("returns not found for a missing Bottle", async () => {
    const error = await waitError(
      routerClient.bottles.target({ bottle: 999_999 }),
    );

    expect(error).toMatchObject({
      status: 404,
      message: "Catalog target not found (bottleId=999999).",
    });
  });

  test("returns conflict when an active Bottle has lost its exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Missing Exact Target" });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    await db
      .delete(bottleAliases)
      .where(eq(bottleAliases.targetId, target!.id));
    await db.delete(catalogTargets).where(eq(catalogTargets.id, target!.id));

    const error = await waitError(
      routerClient.bottles.target({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: expect.stringContaining(
        "the active Bottle does not own an exact target",
      ),
    });
  });

  test("returns conflict for a retired Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "Retired Target" });
    const replacement = await fixtures.Bottle({ name: "Target Replacement" });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      routerClient.bottles.target({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `Catalog target is retired (bottleId=${bottle.id}).`,
    });
  });
});
