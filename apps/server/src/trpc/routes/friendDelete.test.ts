import { db } from "@peated/server/db";
import { follows } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { and, eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.friendDelete(1));
  expect(err).toMatchInlineSnapshot();
});

test("cannot unfriend self", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const err = await waitError(caller.friendDelete(defaults.user.id));
  expect(err).toMatchInlineSnapshot();
});

test("can unfriend new link", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User();

  const caller = createCaller({ user: defaults.user });
  const data = await caller.friendDelete(otherUser.id);
  expect(data.status).toBe("none");

  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, defaults.user.id),
        eq(follows.toUserId, otherUser.id),
      ),
    );
  expect(follow).toBeUndefined();
});

test("can unfriend existing link", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User();

  await fixtures.Follow({
    fromUserId: defaults.user.id,
    toUserId: otherUser.id,
  });

  const caller = createCaller({ user: defaults.user });
  const data = await caller.friendDelete(otherUser.id);
  expect(data.status).toBe("none");

  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, defaults.user.id),
        eq(follows.toUserId, otherUser.id),
      ),
    );
  expect(follow).toBeDefined();
  expect(follow.status).toBe("none");
});
