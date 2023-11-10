import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.notificationDelete(1)).rejects.toThrowError(
    /UNAUTHORIZED/,
  );
});

test("invalid notification", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() => caller.notificationDelete(1)).rejects.toThrowError(
    /Notification not found/,
  );
});

test("delete own notification", async () => {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: DefaultFixtures.user.id,
      fromUserId: (await Fixtures.User()).id,
      type: "friend_request",
      objectId: 1,
      createdAt: new Date(),
    })
    .returning();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  await caller.notificationDelete(notification.id);

  const [newNotification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notification.id));
  expect(newNotification).toBeUndefined();
});

test("cannot delete others notification", async () => {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: (await Fixtures.User()).id,
      fromUserId: DefaultFixtures.user.id,
      type: "friend_request",
      objectId: 1,
      createdAt: new Date(),
    })
    .returning();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() => caller.notificationDelete(notification.id)).rejects.toThrowError(
    /Cannot delete another user's notification/,
  );
});
