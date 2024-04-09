import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.notificationUpdate({
      notification: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
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

  const caller = createCaller({ user: defaults.user });
  const data = await caller.notificationUpdate({
    notification: notification.id,
    read: true,
  });

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

  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.notificationUpdate({
      notification: notification.id,
      read: true,
    }),
  );
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: Cannot edit another user's notification.]`,
  );
});
