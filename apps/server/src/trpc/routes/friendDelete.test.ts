import { db } from "@peated/server/db";
import { follows } from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.friendDelete(1)).rejects.toThrowError(/UNAUTHORIZED/);
});

test("cannot unfriend self", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.friendDelete(DefaultFixtures.user.id),
  ).rejects.toThrowError(/Cannot unfriend yourself/);
});

test("can unfriend new link", async () => {
  const otherUser = await Fixtures.User();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.friendDelete(otherUser.id);
  expect(data.status).toBe("none");

  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, DefaultFixtures.user.id),
        eq(follows.toUserId, otherUser.id),
      ),
    );
  expect(follow).toBeUndefined();
});

test("can unfriend existing link", async () => {
  const otherUser = await Fixtures.User();

  await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: otherUser.id,
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.friendDelete(otherUser.id);
  expect(data.status).toBe("none");

  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, DefaultFixtures.user.id),
        eq(follows.toUserId, otherUser.id),
      ),
    );
  expect(follow).toBeDefined();
  expect(follow.status).toBe("none");
});
