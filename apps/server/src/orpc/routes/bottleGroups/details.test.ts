import { db } from "@peated/server/db";
import { bottleGroups } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /bottle-groups/:group", () => {
  test("returns direct group-owned relationship and aggregate data", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Group Details" });
    await db
      .update(bottleGroups)
      .set({ avgRating: 1.25, totalTastings: 7 })
      .where(eq(bottleGroups.id, bottle.groupId as number));

    const result = await routerClient.bottleGroups.details({
      group: bottle.groupId as number,
    });

    expect(result).toMatchObject({
      id: bottle.groupId,
      name: bottle.name,
      representativeBottleId: bottle.id,
      avgRating: 1.25,
      totalTastings: 7,
      totalBottles: 1,
    });
    expect(result).not.toHaveProperty("kind");
  });

  test("returns not found for an unknown group", async () => {
    const error = await waitError(
      routerClient.bottleGroups.details({ group: 999_999 }),
    );

    expect(error.message).toBe("Bottle Group not found (groupId=999999).");
  });
});
