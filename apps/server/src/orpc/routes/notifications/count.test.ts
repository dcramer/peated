import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /notifications/count", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.notifications.count(undefined, {
        context: { user: null },
      })
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("counts all notifications by default", async ({ fixtures }) => {
    const user = await fixtures.User();
    await db.insert(notifications).values({
      userId: user.id,
      type: "toast",
      objectId: 1,
      createdAt: new Date(),
    });
    await db.insert(notifications).values({
      userId: user.id,
      type: "toast",
      objectId: 2,
      createdAt: new Date(),
      read: true,
    });

    const { count } = await routerClient.notifications.count(undefined, {
      context: { user },
    });
    expect(count).toBe(2);
  });

  test("counts all notifications with filter 'all'", async ({ fixtures }) => {
    const user = await fixtures.User();
    await db.insert(notifications).values({
      userId: user.id,
      type: "toast",
      objectId: 1,
      createdAt: new Date(),
    });
    await db.insert(notifications).values({
      userId: user.id,
      type: "toast",
      objectId: 2,
      createdAt: new Date(),
      read: true,
    });

    const { count } = await routerClient.notifications.count(
      { filter: "all" },
      {
        context: { user },
      }
    );
    expect(count).toBe(2);
  });

  test("counts only unread notifications with filter 'unread'", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    await db.insert(notifications).values({
      userId: user.id,
      type: "toast",
      objectId: 1,
      createdAt: new Date(),
      read: false,
    });
    await db.insert(notifications).values({
      userId: user.id,
      type: "toast",
      objectId: 2,
      createdAt: new Date(),
      read: true,
    });
    await db.insert(notifications).values({
      userId: user.id,
      type: "toast",
      objectId: 3,
      createdAt: new Date(),
      read: false,
    });

    const { count } = await routerClient.notifications.count(
      { filter: "unread" },
      {
        context: { user },
      }
    );
    expect(count).toBe(2);
  });

  test("returns 0 if no notifications", async ({ fixtures }) => {
    const user = await fixtures.User();
    const { count } = await routerClient.notifications.count(undefined, {
      context: { user },
    });
    expect(count).toBe(0);
  });

  test("returns 0 if no unread notifications with filter 'unread'", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    await db.insert(notifications).values({
      userId: user.id,
      type: "toast",
      objectId: 1,
      createdAt: new Date(),
      read: true,
    });
    await db.insert(notifications).values({
      userId: user.id,
      type: "toast",
      objectId: 2,
      createdAt: new Date(),
      read: true,
    });

    const { count } = await routerClient.notifications.count(
      { filter: "unread" },
      {
        context: { user },
      }
    );
    expect(count).toBe(0);
  });
});
