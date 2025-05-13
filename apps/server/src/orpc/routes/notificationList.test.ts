import { db } from "@peated/server/db";
import { describe, expect, test } from "vitest";
import { createNotification } from "../../lib/notifications";
import { routerClient } from "../router";

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

    const { results } = await routerClient.notificationList(
      {},
      { context: { user: defaults.user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(notification.id);
    expect(results[0].type).toEqual("toast");
    expect(results[0].ref).toBeDefined();
    expect(results[0].ref.id).toEqual(tasting.id);
  });

  test("lists notifications w/ comment", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });
    const comment = await fixtures.Comment({ tastingId: tasting.id });
    const notification = await createNotification(db, {
      objectId: comment.id,
      type: "comment",
      userId: tasting.createdById,
      fromUserId: comment.createdById,
      createdAt: comment.createdAt,
    });

    const { results } = await routerClient.notificationList(
      {},
      { context: { user: defaults.user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(notification.id);
    expect(results[0].type).toEqual("comment");
    expect(results[0].ref).toBeDefined();
    expect(results[0].ref.id).toEqual(tasting.id);
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

    const { results } = await routerClient.notificationList(
      {},
      { context: { user: defaults.user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(notification.id);
    expect(results[0].type).toEqual("friend_request");
    expect(results[0].ref).toBeDefined();
    expect(results[0].ref.user.id).toEqual(follow.fromUserId);
  });
});
