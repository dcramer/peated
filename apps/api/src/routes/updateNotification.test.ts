import { db } from "@peated/core/db";
import { notifications } from "@peated/core/db/schema";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    app.close();
  };
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

  const response = await app.inject({
    method: "PUT",
    url: `/notifications/${notification.id}`,
    payload: {
      read: true,
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
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

  const response = await app.inject({
    method: "PUT",
    url: `/notifications/${notification.id}`,
    payload: {
      read: true,
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(403);
});
