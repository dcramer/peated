import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.notificationUpdate({
      notification: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("mark own notification as read", async () => {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: DefaultFixtures.user.id,
      fromUserId: (await Fixtures.User()).id,
      type: "toast",
      objectId: 1,
      createdAt: new Date(),
    })
    .returning();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
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

test("cannot update others notification", async () => {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: (await Fixtures.User()).id,
      fromUserId: DefaultFixtures.user.id,
      type: "toast",
      objectId: 1,
      createdAt: new Date(),
    })
    .returning();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.notificationUpdate({
      notification: notification.id,
      read: true,
    }),
  ).rejects.toThrowError(/Cannot edit another user's notification/);
});
