import { db } from "@peated/server/db";
import { follows } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /tastings/:tasting", () => {
  test("get tasting by id", async ({ fixtures }) => {
    const tasting = await fixtures.Tasting();

    const data = await routerClient.tastings.details({
      tasting: tasting.id,
    });
    expect(data.id).toEqual(tasting.id);
  });

  test("errors on invalid tasting", async () => {
    const err = await waitError(
      routerClient.tastings.details({
        tasting: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Tasting not found.]`);
  });

  test("hides private tastings from visitors, strangers, and pending followers", async ({
    fixtures,
  }) => {
    const author = await fixtures.User({ private: true });
    const stranger = await fixtures.User();
    const pendingFollower = await fixtures.User();
    const tasting = await fixtures.Tasting({ createdById: author.id });
    await db.insert(follows).values({
      fromUserId: pendingFollower.id,
      toUserId: author.id,
      status: "pending",
    });

    for (const user of [undefined, stranger, pendingFollower]) {
      const error = await waitError(
        routerClient.tastings.details(
          { tasting: tasting.id },
          { context: { user } },
        ),
      );
      expect(error).toMatchObject({ code: "NOT_FOUND" });
    }
  });

  test("lets authors and accepted followers read private tastings", async ({
    fixtures,
  }) => {
    const author = await fixtures.User({ private: true });
    const follower = await fixtures.User();
    const tasting = await fixtures.Tasting({ createdById: author.id });
    await db.insert(follows).values({
      fromUserId: follower.id,
      toUserId: author.id,
      status: "following",
    });

    for (const user of [author, follower]) {
      await expect(
        routerClient.tastings.details(
          { tasting: tasting.id },
          { context: { user } },
        ),
      ).resolves.toMatchObject({ id: tasting.id });
    }
  });
});
