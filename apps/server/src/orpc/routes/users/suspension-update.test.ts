import { db } from "@peated/server/db";
import { tastings, users } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PUT /users/:user/suspension", () => {
  test("requires a moderator or administrator", async ({
    defaults,
    fixtures,
  }) => {
    const other = await fixtures.User();
    const err = await waitError(() =>
      routerClient.users.suspensionUpdate(
        { user: other.id, suspended: true, reason: "Spam." },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("needs a reason and cannot target admins or yourself", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const admin = await fixtures.User({ admin: true });
    const other = await fixtures.User();

    expect(
      await waitError(() =>
        routerClient.users.suspensionUpdate(
          { user: other.id, suspended: true },
          { context: { user: moderator } },
        ),
      ),
    ).toMatchInlineSnapshot(
      `[Error: A reason is required to suspend a member.]`,
    );
    expect(
      await waitError(() =>
        routerClient.users.suspensionUpdate(
          { user: admin.id, suspended: true, reason: "Spam." },
          { context: { user: moderator } },
        ),
      ),
    ).toMatchInlineSnapshot(`[Error: Administrators cannot be suspended.]`);
    expect(
      await waitError(() =>
        routerClient.users.suspensionUpdate(
          { user: moderator.id, suspended: true, reason: "Spam." },
          { context: { user: moderator } },
        ),
      ),
    ).toMatchInlineSnapshot(`[Error: You cannot suspend yourself.]`);

    const otherModerator = await fixtures.User({ mod: true });
    expect(
      await waitError(() =>
        routerClient.users.suspensionUpdate(
          { user: otherModerator.id, suspended: true, reason: "Spam." },
          { context: { user: moderator } },
        ),
      ),
    ).toMatchInlineSnapshot(
      `[Error: Only an administrator can suspend a moderator.]`,
    );
    const suspendedModerator = await routerClient.users.suspensionUpdate(
      { user: otherModerator.id, suspended: true, reason: "Spam." },
      { context: { user: admin } },
    );
    expect(suspendedModerator.suspendedAt).toEqual(expect.any(String));
  });

  test("suspends and reinstates a member", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });
    const member = await fixtures.User();

    const suspended = await routerClient.users.suspensionUpdate(
      { user: member.username, suspended: true, reason: "Repeated spam." },
      { context: { user: moderator } },
    );
    expect(suspended.suspendedAt).toEqual(expect.any(String));
    expect(suspended.suspensionReason).toBe("Repeated spam.");
    const [row] = await db.select().from(users).where(eq(users.id, member.id));
    expect(row.suspendedById).toBe(moderator.id);

    // The member sees their own suspension; other members do not.
    const self = await routerClient.auth.me({}, { context: { user: row } });
    expect(self.user.suspensionReason).toBe("Repeated spam.");
    const other = await fixtures.User();
    const seenByOther = await routerClient.users.details(
      { user: member.id },
      { context: { user: other } },
    );
    expect(seenByOther.suspendedAt).toBeUndefined();

    const reinstated = await routerClient.users.suspensionUpdate(
      { user: member.id, suspended: false },
      { context: { user: moderator } },
    );
    expect(reinstated.suspendedAt).toBeUndefined();
    const [after] = await db
      .select()
      .from(users)
      .where(eq(users.id, member.id));
    expect(after.suspendedAt).toBeNull();
    expect(after.suspensionReason).toBeNull();
  });

  test("a suspended member can only read, delete, or recover their account", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const member = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const existing = await fixtures.Tasting({ createdById: member.id });
    await routerClient.users.suspensionUpdate(
      { user: member.id, suspended: true, reason: "Repeated spam." },
      { context: { user: moderator } },
    );
    const [suspended] = await db
      .select()
      .from(users)
      .where(eq(users.id, member.id));
    const asSuspended = { context: { user: suspended } };

    expect(
      await waitError(() =>
        routerClient.tastings.create({ bottle: bottle.id }, asSuspended),
      ),
    ).toMatchInlineSnapshot(
      `[Error: Your account is suspended. You can only delete your account or cancel a pending deletion.]`,
    );
    const blockedCalls: Array<() => Promise<object>> = [
      () =>
        routerClient.tastings.details({ tasting: existing.id }, asSuspended),
      () => routerClient.tastings.delete({ tasting: existing.id }, asSuspended),
      () =>
        routerClient.users.update({ user: "me", private: true }, asSuspended),
      () => routerClient.users.blockCreate({ user: moderator.id }, asSuspended),
      () =>
        routerClient.reports.create(
          { objectType: "user", objectId: moderator.id, reason: "other" },
          asSuspended,
        ),
    ];
    for (const blocked of blockedCalls) {
      expect(await waitError(blocked)).toMatchObject({
        code: "ACCOUNT_SUSPENDED",
        status: 403,
      });
    }

    const me = await routerClient.auth.me({}, asSuspended);
    expect(me.user.suspensionReason).toBe("Repeated spam.");
    const kept = await routerClient.users.deletionCancel(
      { user: "me" },
      asSuspended,
    );
    expect(kept.id).toBe(member.id);
  });
});
