import { db } from "@peated/server/db";
import { createNotification } from "@peated/server/lib/notifications";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /notifications", () => {
  test("lists notifications w/ toast", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });
    const toast = await fixtures.Toast({ tastingId: tasting.id });
    const notification = await createNotification(db, {
      objectId: toast.id,
      type: "toast",
      userId: tasting.createdById,
      fromUserId: toast.createdById,
      createdAt: toast.createdAt,
    });

    const { results } = await routerClient.notifications.list(
      {},
      { context: { user: defaults.user } },
    );

    const result = results[0];
    expect(result?.id).toEqual(notification.id);
    if (result?.type !== "toast" || !result.ref) {
      throw new Error("Missing toast notification tasting");
    }
    expect(result.ref.id).toEqual(tasting.id);
    expect(result.ref.target).toMatchObject({
      kind: "bottle",
      targetId: tasting.targetId,
      bottle: { id: tasting.bottleId },
    });
  });

  test("lists notifications w/ comment", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(
          eq(table.groupId, bottle.groupId as number),
          isNull(table.bottleId),
        ),
    });
    if (!genericTarget) throw new Error("Missing generic target fixture");
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
      bottleId: bottle.id,
      targetId: genericTarget.id,
    });
    const comment = await fixtures.Comment({ tastingId: tasting.id });
    const notification = await createNotification(db, {
      objectId: comment.id,
      type: "comment",
      userId: tasting.createdById,
      fromUserId: comment.createdById,
      createdAt: comment.createdAt,
    });

    const { results } = await routerClient.notifications.list(
      {},
      { context: { user: defaults.user } },
    );

    const result = results[0];
    expect(result?.id).toEqual(notification.id);
    if (result?.type !== "comment" || !result.ref) {
      throw new Error("Missing comment notification tasting");
    }
    expect(result.ref.id).toEqual(tasting.id);
    expect(result.ref.target).toMatchObject({
      kind: "group",
      targetId: genericTarget.id,
      group: { id: bottle.groupId },
    });
  });

  test("lists notifications w/ friend_request", async ({
    defaults,
    fixtures,
  }) => {
    const follow = await fixtures.Follow({ toUserId: defaults.user.id });
    const notification = await createNotification(db, {
      objectId: follow.id,
      type: "friend_request",
      userId: follow.toUserId,
      fromUserId: follow.fromUserId,
      createdAt: follow.createdAt,
    });

    const { results } = await routerClient.notifications.list(
      {},
      { context: { user: defaults.user } },
    );

    const result = results[0];
    expect(result?.id).toEqual(notification.id);
    if (result?.type !== "friend_request" || !result.ref) {
      throw new Error("Missing friend request notification reference");
    }
    expect(result.ref).toEqual({
      status: follow.status === "following" ? "friends" : follow.status,
      userId: follow.fromUserId,
    });
  });

  test("returns a null ref when the referenced object is missing", async ({
    defaults,
    fixtures,
  }) => {
    const fromUser = await fixtures.User();
    const notification = await createNotification(db, {
      objectId: 999999,
      type: "friend_request",
      userId: defaults.user.id,
      fromUserId: fromUser.id,
      createdAt: new Date(),
    });

    const { results } = await routerClient.notifications.list(
      {},
      { context: { user: defaults.user } },
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: notification.id,
      type: "friend_request",
      ref: null,
    });
  });

  test("returns a null friend request ref when the sender does not match", async ({
    defaults,
    fixtures,
  }) => {
    const follow = await fixtures.Follow({ toUserId: defaults.user.id });
    const mismatchedSender = await fixtures.User();
    const notification = await createNotification(db, {
      objectId: follow.id,
      type: "friend_request",
      userId: defaults.user.id,
      fromUserId: mismatchedSender.id,
      createdAt: follow.createdAt,
    });

    const { results } = await routerClient.notifications.list(
      {},
      { context: { user: defaults.user } },
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: notification.id,
      type: "friend_request",
      fromUser: { id: mismatchedSender.id },
      ref: null,
    });
  });

  test("returns a null friend request ref when the recipient does not match", async ({
    defaults,
    fixtures,
  }) => {
    const sender = await fixtures.User();
    const otherRecipient = await fixtures.User();
    const follow = await fixtures.Follow({
      fromUserId: sender.id,
      toUserId: otherRecipient.id,
    });
    const notification = await createNotification(db, {
      objectId: follow.id,
      type: "friend_request",
      userId: defaults.user.id,
      fromUserId: sender.id,
      createdAt: follow.createdAt,
    });

    const { results } = await routerClient.notifications.list(
      {},
      { context: { user: defaults.user } },
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: notification.id,
      type: "friend_request",
      fromUser: { id: sender.id },
      ref: null,
    });
  });

  for (const type of ["toast", "comment"] as const) {
    test(`returns a null ref when the referenced ${type} is missing`, async ({
      defaults,
      fixtures,
    }) => {
      const fromUser = await fixtures.User();
      const notification = await createNotification(db, {
        objectId: 999999,
        type,
        userId: defaults.user.id,
        fromUserId: fromUser.id,
        createdAt: new Date(),
      });

      const { results } = await routerClient.notifications.list(
        {},
        { context: { user: defaults.user } },
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: notification.id,
        type,
        ref: null,
      });
    });
  }
});
