import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("DELETE /notifications/:id", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.notificationDelete({
        id: 1,
      }),
    );
    expect(err.message).toBe("UNAUTHORIZED");
  });

  test("invalid notification", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.notificationDelete(
        {
          id: 1,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err.message).toBe("Notification not found.");
  });

  test("delete own notification", async ({ defaults, fixtures }) => {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: defaults.user.id,
        fromUserId: (await fixtures.User()).id,
        type: "friend_request",
        objectId: 1,
        createdAt: new Date(),
      })
      .returning();

    await routerClient.notificationDelete(
      {
        id: notification.id,
      },
      { context: { user: defaults.user } },
    );

    const [newNotification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notification.id));
    expect(newNotification).toBeUndefined();
  });

  test("cannot delete others notification", async ({ defaults, fixtures }) => {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: (await fixtures.User()).id,
        fromUserId: defaults.user.id,
        type: "friend_request",
        objectId: 1,
        createdAt: new Date(),
      })
      .returning();

    const err = await waitError(() =>
      routerClient.notificationDelete(
        {
          id: notification.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err.message).toBe("Cannot delete another user's notification.");
  });
});
