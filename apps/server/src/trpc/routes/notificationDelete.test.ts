import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  expect(() => caller.notificationDelete(1)).rejects.toThrowError(
    /UNAUTHORIZED/,
  );
});

test("invalid notification", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  expect(() => caller.notificationDelete(1)).rejects.toThrowError(
    /Notification not found/,
  );
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

  const caller = createCaller({ user: defaults.user });
  await caller.notificationDelete(notification.id);

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

  const caller = createCaller({ user: defaults.user });
  expect(() => caller.notificationDelete(notification.id)).rejects.toThrowError(
    /Cannot delete another user's notification/,
  );
});
