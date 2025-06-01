import { db } from "@peated/server/db";
import { follows } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /friends/:user", () => {
  test("requires authentication", async () => {
    const err = await waitError(() => routerClient.friends.delete({ user: 1 }));
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });

  test("cannot unfriend self", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.friends.delete(
        { user: defaults.user.id },
        {
          context: { user: defaults.user },
        }
      )
    );
    expect(err).toMatchInlineSnapshot("[Error: Cannot unfriend yourself.]");
  });

  test("can unfriend new link", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User();

    const data = await routerClient.friends.delete(
      { user: otherUser.id },
      {
        context: { user: defaults.user },
      }
    );
    expect(data.status).toBe("none");

    const [follow] = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.fromUserId, defaults.user.id),
          eq(follows.toUserId, otherUser.id)
        )
      );
    expect(follow).toBeUndefined();
  });

  test("can unfriend existing link", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User();

    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
    });

    const data = await routerClient.friends.delete(
      { user: otherUser.id },
      {
        context: { user: defaults.user },
      }
    );
    expect(data.status).toBe("none");

    const [follow] = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.fromUserId, defaults.user.id),
          eq(follows.toUserId, otherUser.id)
        )
      );
    expect(follow).toBeDefined();
    expect(follow.status).toBe("none");
  });
});
