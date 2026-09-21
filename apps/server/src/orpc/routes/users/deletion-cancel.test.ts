import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /users/{user}/deletion", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.users.deletionCancel({ user: "me" }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot cancel another member's deletion", async ({ fixtures }) => {
    const user = await fixtures.User();
    const other = await fixtures.User({ deletionRequestedAt: new Date() });

    const err = await waitError(() =>
      routerClient.users.deletionCancel(
        { user: other.id },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: You can only cancel your own account deletion.]`,
    );
    expect(
      await db.query.users.findFirst({ where: eq(users.id, other.id) }),
    ).not.toMatchObject({ deletionRequestedAt: null });
  });

  test("clears a pending deletion", async ({ fixtures }) => {
    const user = await fixtures.User({ deletionRequestedAt: new Date() });

    const result = await routerClient.users.deletionCancel(
      { user: "me" },
      { context: { user } },
    );

    expect(result.deletionScheduledAt).toBeUndefined();
    expect(
      await db.query.users.findFirst({ where: eq(users.id, user.id) }),
    ).toMatchObject({ deletionRequestedAt: null, active: true });
  });

  test("does nothing without a pending deletion", async ({ fixtures }) => {
    const user = await fixtures.User();

    const result = await routerClient.users.deletionCancel(
      { user: "me" },
      { context: { user } },
    );

    expect(result).toMatchObject({ id: user.id, username: user.username });
    expect(result.deletionScheduledAt).toBeUndefined();
  });
});
