import { db } from "@peated/server/db";
import { badgeAwards } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /badges/:badge/users", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.badges.userList({
        badge: 1,
      })
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists users for a badge", async ({ defaults, fixtures, expect }) => {
    const badge = await fixtures.Badge();
    const user1 = await fixtures.User();
    const user2 = await fixtures.User();
    await fixtures.BadgeAward({
      badgeId: badge.id,
      userId: user1.id,
      xp: 100,
      level: 1,
    });
    await fixtures.BadgeAward({
      badgeId: badge.id,
      userId: user2.id,
      xp: 200,
      level: 2,
    });

    const { results, rel } = await routerClient.badges.userList(
      {
        badge: badge.id,
      },
      { context: { user: defaults.user } }
    );

    expect(results.length).toBe(2);
    expect(results[0].user.id).toBe(user2.id);
    expect(results[0].xp).toBe(200);
    expect(results[0].level).toBe(2);
    expect(results[1].user.id).toBe(user1.id);
    expect(results[1].xp).toBe(100);
    expect(results[1].level).toBe(1);
    expect(rel.nextCursor).toBeNull();
    expect(rel.prevCursor).toBeNull();
  });

  test("paginates results", async ({ defaults, fixtures, expect }) => {
    const badge = await fixtures.Badge();
    const users = await Promise.all(
      Array.from({ length: 3 }, () => fixtures.User())
    );
    for (let i = 0; i < users.length; i++) {
      await fixtures.BadgeAward({
        badgeId: badge.id,
        userId: users[i].id,
        xp: 100 * (i + 1),
        level: i + 1,
      });
    }

    const { results, rel } = await routerClient.badges.userList(
      {
        badge: badge.id,
        limit: 2,
        cursor: 1,
      },
      { context: { user: defaults.user } }
    );

    expect(results.length).toBe(2);
    expect(results[0].user.id).toBe(users[2].id);
    expect(results[1].user.id).toBe(users[1].id);
    expect(rel.nextCursor).toBe(2);
    expect(rel.prevCursor).toBeNull();
  });

  test("excludes private users", async ({ defaults, fixtures, expect }) => {
    const badge = await fixtures.Badge();
    const publicUser = await fixtures.User();
    const privateUser = await fixtures.User({ private: true });
    await fixtures.BadgeAward({
      badgeId: badge.id,
      userId: publicUser.id,
      xp: 100,
      level: 1,
    });
    await fixtures.BadgeAward({
      badgeId: badge.id,
      userId: privateUser.id,
      xp: 200,
      level: 2,
    });

    const { results } = await routerClient.badges.userList(
      {
        badge: badge.id,
      },
      { context: { user: defaults.user } }
    );

    expect(results.length).toBe(1);
    expect(results[0].user.id).toBe(publicUser.id);
  });

  test("excludes users with level 0", async ({
    defaults,
    fixtures,
    expect,
  }) => {
    const badge = await fixtures.Badge();
    const user1 = await fixtures.User();
    const user2 = await fixtures.User();
    await fixtures.BadgeAward({
      badgeId: badge.id,
      userId: user1.id,
      xp: 100,
      level: 1,
    });
    await fixtures.BadgeAward({
      badgeId: badge.id,
      userId: user2.id,
      xp: 0,
      level: 0,
    });

    const { results } = await routerClient.badges.userList(
      {
        badge: badge.id,
      },
      { context: { user: defaults.user } }
    );

    expect(results.length).toBe(1);
    expect(results[0].user.id).toBe(user1.id);
  });

  test("sorts results by xp descending", async ({
    defaults,
    fixtures,
    expect,
  }) => {
    const badge = await fixtures.Badge();
    const user1 = await fixtures.User();
    const user2 = await fixtures.User();
    await fixtures.BadgeAward({
      badgeId: badge.id,
      userId: user1.id,
      xp: 100,
      level: 1,
    });
    await fixtures.BadgeAward({
      badgeId: badge.id,
      userId: user2.id,
      xp: 200,
      level: 2,
    });

    const { results } = await routerClient.badges.userList(
      {
        badge: badge.id,
      },
      { context: { user: defaults.user } }
    );

    expect(results.length).toBe(2);
    expect(results[0].user.id).toBe(user2.id);
    expect(results[1].user.id).toBe(user1.id);
  });

  test("throws NOT_FOUND for non-existent badge", async ({
    defaults,
    expect,
  }) => {
    const err = await waitError(
      routerClient.badges.userList(
        {
          badge: 9999, // Non-existent badge ID
        },
        { context: { user: defaults.user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Badge not found.]`);
  });
});
