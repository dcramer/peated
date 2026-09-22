import { db } from "@peated/server/db";
import { follows, notifications, userBlocks } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /users/:user/block", () => {
  test("requires auth", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.users.blockCreate({ user: defaults.user.id }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot block yourself", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.users.blockCreate(
        { user: defaults.user.id },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: You cannot block yourself.]`);
  });

  test("blocks a member and ends the friendship in both directions", async ({
    defaults,
    fixtures,
  }) => {
    const other = await fixtures.User();
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: other.id,
      status: "following",
    });
    const theirFollow = await fixtures.Follow({
      fromUserId: other.id,
      toUserId: defaults.user.id,
      status: "pending",
    });
    await db.insert(notifications).values({
      userId: defaults.user.id,
      fromUserId: other.id,
      objectId: theirFollow.id,
      type: "friend_request",
      createdAt: theirFollow.createdAt,
    });

    const result = await routerClient.users.blockCreate(
      { user: other.username },
      { context: { user: defaults.user } },
    );
    expect(result.id).toBe(other.id);
    expect(result.blocked).toBe(true);
    expect(result.friendStatus).toBe("none");

    const followRows = await db
      .select()
      .from(follows)
      .where(eq(follows.toUserId, other.id));
    expect(followRows.map((row) => row.status)).toEqual(["none"]);
    const [theirs] = await db
      .select()
      .from(follows)
      .where(eq(follows.id, theirFollow.id));
    expect(theirs.status).toBe("none");
    const pending = await db
      .select()
      .from(notifications)
      .where(eq(notifications.objectId, theirFollow.id));
    expect(pending).toHaveLength(0);

    // Blocking again changes nothing.
    await routerClient.users.blockCreate(
      { user: other.id },
      { context: { user: defaults.user } },
    );
    const blocks = await db
      .select()
      .from(userBlocks)
      .where(eq(userBlocks.userId, defaults.user.id));
    expect(blocks).toHaveLength(1);
  });

  test("stops comments, toasts, and friend requests both ways", async ({
    defaults,
    fixtures,
  }) => {
    const other = await fixtures.User();
    const myTasting = await fixtures.Tasting({ createdById: defaults.user.id });
    const theirTasting = await fixtures.Tasting({ createdById: other.id });
    await routerClient.users.blockCreate(
      { user: other.id },
      { context: { user: defaults.user } },
    );

    expect(
      await waitError(() =>
        routerClient.comments.create(
          {
            tasting: myTasting.id,
            comment: "Hi",
            createdAt: new Date().toISOString(),
          },
          { context: { user: other } },
        ),
      ),
    ).toMatchInlineSnapshot(
      `[Error: You cannot comment on this member's tastings.]`,
    );
    expect(
      await waitError(() =>
        routerClient.comments.create(
          {
            tasting: theirTasting.id,
            comment: "Hi",
            createdAt: new Date().toISOString(),
          },
          { context: { user: defaults.user } },
        ),
      ),
    ).toMatchInlineSnapshot(
      `[Error: You cannot comment on this member's tastings.]`,
    );
    expect(
      await waitError(() =>
        routerClient.toasts.create(
          { tasting: myTasting.id },
          { context: { user: other } },
        ),
      ),
    ).toMatchInlineSnapshot(
      `[Error: You cannot toast this member's tastings.]`,
    );
    expect(
      await waitError(() =>
        routerClient.friends.create(
          { user: defaults.user.id },
          { context: { user: other } },
        ),
      ),
    ).toMatchInlineSnapshot(
      `[Error: You cannot send this member a friend request.]`,
    );
    expect(
      await waitError(() =>
        routerClient.friends.create(
          { user: other.id },
          { context: { user: defaults.user } },
        ),
      ),
    ).toMatchInlineSnapshot(
      `[Error: You cannot send this member a friend request.]`,
    );

    // Content stays visible to both members.
    const theirs = await routerClient.tastings.details(
      { tasting: theirTasting.id },
      { context: { user: defaults.user } },
    );
    expect(theirs.id).toBe(theirTasting.id);
    expect(theirs.createdBy.blocked).toBe(true);
  });
});

describe("DELETE /users/:user/block", () => {
  test("removes only your own block", async ({ defaults, fixtures }) => {
    const other = await fixtures.User();
    await routerClient.users.blockCreate(
      { user: other.id },
      { context: { user: defaults.user } },
    );
    await routerClient.users.blockCreate(
      { user: defaults.user.id },
      { context: { user: other } },
    );

    const result = await routerClient.users.blockDelete(
      { user: other.id },
      { context: { user: defaults.user } },
    );
    expect(result.blocked).toBe(false);

    const remaining = await db.select().from(userBlocks);
    expect(remaining).toEqual([
      expect.objectContaining({
        userId: other.id,
        blockedUserId: defaults.user.id,
      }),
    ]);

    // Their block still stops interaction.
    const tasting = await fixtures.Tasting({ createdById: other.id });
    expect(
      await waitError(() =>
        routerClient.toasts.create(
          { tasting: tasting.id },
          { context: { user: defaults.user } },
        ),
      ),
    ).toMatchInlineSnapshot(
      `[Error: You cannot toast this member's tastings.]`,
    );
  });
});

describe("GET /users/:user/blocks", () => {
  test("lists only your own blocked members", async ({
    defaults,
    fixtures,
  }) => {
    const first = await fixtures.User();
    const second = await fixtures.User();
    await routerClient.users.blockCreate(
      { user: first.id },
      { context: { user: defaults.user } },
    );
    await routerClient.users.blockCreate(
      { user: second.id },
      { context: { user: defaults.user } },
    );

    const { results } = await routerClient.users.blockList(
      { user: "me" },
      { context: { user: defaults.user } },
    );
    expect(results.map(({ user }) => user.id).sort((a, b) => a - b)).toEqual(
      [first.id, second.id].sort((a, b) => a - b),
    );
    expect(results.every(({ user }) => user.blocked)).toBe(true);

    const err = await waitError(() =>
      routerClient.users.blockList(
        { user: defaults.user.id },
        { context: { user: first } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: You can only view your own blocked members.]`,
    );
  });
});

describe("account deletion", () => {
  test("removes the member's blocks", async ({ defaults, fixtures }) => {
    const other = await fixtures.User();
    await routerClient.users.blockCreate(
      { user: other.id },
      { context: { user: defaults.user } },
    );
    const { deleteUserAccount } =
      await import("@peated/server/lib/accountDeletion");
    await deleteUserAccount(other);
    const remaining = await db
      .select()
      .from(userBlocks)
      .where(
        and(
          eq(userBlocks.userId, defaults.user.id),
          eq(userBlocks.blockedUserId, other.id),
        ),
      );
    expect(remaining).toHaveLength(0);
  });
});
