import { db } from "@peated/server/db";
import { memberReviews, users } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { compareSync } from "bcrypt";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const STATS_JOB_OPTIONS = {
  delay: 5000,
  removeOnComplete: true,
  removeOnFail: false,
};

describe("PATCH /users/:user", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
  });
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.users.update({
        user: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot update another user", async ({ fixtures }) => {
    const user = await fixtures.User();
    const otherUser = await fixtures.User();

    const err = await waitError(() =>
      routerClient.users.update(
        {
          user: otherUser.id,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot edit another user.]`);
  });

  test("can change username", async ({ defaults, fixtures }) => {
    const data = await routerClient.users.update(
      {
        user: defaults.user.id,
        username: "JoeBlow",
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, defaults.user.id));
    expect(user?.username).toEqual("joeblow");
  });

  test("can change mod as admin", async ({ defaults, fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.users.update(
      {
        user: defaults.user.id,
        mod: true,
      },
      { context: { user: adminUser } },
    );

    expect(data.id).toBeDefined();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, defaults.user.id));
    expect(user?.mod).toEqual(true);
  });

  test("can change admin as admin", async ({ defaults, fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.users.update(
      {
        user: defaults.user.id,
        admin: true,
      },
      { context: { user: adminUser } },
    );

    expect(data.id).toBeDefined();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, defaults.user.id));
    expect(user?.admin).toEqual(true);
  });

  test("cannot change mod as user", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.users.update(
        {
          user: defaults.user.id,
          mod: true,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Admin privileges required to modify mod status.]`,
    );
  });

  test("cannot change admin as user", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.users.update(
        {
          user: defaults.user.id,
          admin: true,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Admin privileges required to modify admin status.]`,
    );
  });

  test("can change password", async ({ defaults, fixtures }) => {
    const data = await routerClient.users.update(
      {
        user: defaults.user.id,
        username: "JoeBlow",
        password: "testpassword",
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, defaults.user.id));
    expect(compareSync("testpassword", user.passwordHash || "")).toBe(true);
  });

  test("refreshes every affected Bottle when privacy changes", async ({
    defaults,
    fixtures,
  }) => {
    const first = await fixtures.Bottle();
    const second = await fixtures.Bottle();
    await fixtures.Tasting({
      bottleId: first.id,
      createdById: defaults.user.id,
    });
    await db.insert(memberReviews).values([
      {
        bottleId: first.id,
        createdById: defaults.user.id,
        score: 88,
      },
      {
        bottleId: second.id,
        createdById: defaults.user.id,
        score: 89,
      },
    ]);

    await routerClient.users.update(
      { user: defaults.user.id, private: true },
      { context: { user: defaults.user } },
    );

    expect(workerClient.pushJob).toHaveBeenCalledTimes(2);
    for (const bottle of [first, second]) {
      expect(workerClient.pushJob).toHaveBeenCalledWith(
        "UpdateBottleStats",
        { bottleId: bottle.id },
        STATS_JOB_OPTIONS,
      );
    }
  });

  test("rejects invalid username", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.users.update(
        {
          user: defaults.user.id,
          username: "me",
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Invalid username.]`);
  });
});
