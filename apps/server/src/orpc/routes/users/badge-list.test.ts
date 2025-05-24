import { db } from "@peated/server/db";
import { badgeAwards } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/badges", () => {
  test("lists badges", async ({ fixtures }) => {
    const user1 = await fixtures.User();

    const badge1 = await fixtures.Badge();
    const badge2 = await fixtures.Badge();

    const [award1] = await db
      .insert(badgeAwards)
      .values({
        badgeId: badge1.id,
        userId: user1.id,
        level: 1,
        xp: 10,
        // older
        createdAt: new Date("2024-08-01T00:00:00.000Z"),
      })
      .returning();
    const [award2] = await db
      .insert(badgeAwards)
      .values({
        badgeId: badge2.id,
        userId: user1.id,
        xp: 1,
        level: 0,
        createdAt: new Date("2024-08-02T00:00:00.000Z"),
      })
      .returning();

    const { results } = await routerClient.users.badgeList({
      user: user1.id,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toEqual(award1.id);
    expect(results[1].id).toEqual(award2.id);
  });
});
