import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PUT /notifications/:notification", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.notifications.update({
        notification: 1,
      })
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("mark own notification as read", async ({ defaults, fixtures }) => {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: defaults.user.id,
        fromUserId: (await fixtures.User()).id,
        type: "toast",
        objectId: 1,
        createdAt: new Date(),
      })
      .returning();

    const data = await routerClient.notifications.update(
      {
        notification: notification.id,
        read: true,
      },
      { context: { user: defaults.user } }
    );

    expect(data.read).toBe(true);

    const [newNotification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notification.id));
    expect(newNotification.read).toBe(true);
  });

  test("cannot update others notification", async ({ defaults, fixtures }) => {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: (await fixtures.User()).id,
        fromUserId: defaults.user.id,
        type: "toast",
        objectId: 1,
        createdAt: new Date(),
      })
      .returning();

    const err = await waitError(() =>
      routerClient.notifications.update(
        {
          notification: notification.id,
          read: true,
        },
        { context: { user: defaults.user } }
      )
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot edit another user's notification.]`
    );
  });
});
