import { createRouterClient } from "@orpc/server";
import { db } from "@peated/server/db";
import {
  identities,
  tastings,
  users,
  type User,
} from "@peated/server/db/schema";
import { ACCOUNT_DELETION_GRACE_MS } from "@peated/server/lib/accountDeletion";
import { AppleRevocationError } from "@peated/server/lib/apple";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDeleteUserProcedure, type DeleteUserServices } from "./delete";

const revokeAppleAuthorization =
  vi.fn<DeleteUserServices["revokeAppleAuthorization"]>();
const isAppleRevocationConfigured =
  vi.fn<DeleteUserServices["isAppleRevocationConfigured"]>();
const sendAccountDeletionEmail =
  vi.fn<DeleteUserServices["sendAccountDeletionEmail"]>();
const client = createRouterClient(
  {
    delete: createDeleteUserProcedure({
      revokeAppleAuthorization,
      isAppleRevocationConfigured,
      sendAccountDeletionEmail,
    }),
  },
  { context: ({ user }: { user: User | null }) => ({ user }) },
);

async function findUser(id: number) {
  return await db.query.users.findFirst({ where: eq(users.id, id) });
}

async function appleUser(fixtures: Pick<typeof Fixtures, "User">) {
  const user = await fixtures.User();
  await db.insert(identities).values({
    provider: "apple",
    externalId: `apple-${user.id}`,
    userId: user.id,
  });
  return user;
}

describe("DELETE /users/{user}", () => {
  beforeEach(() => {
    revokeAppleAuthorization.mockReset().mockResolvedValue(undefined);
    isAppleRevocationConfigured.mockReset().mockReturnValue(true);
    sendAccountDeletionEmail.mockReset().mockResolvedValue(undefined);
  });

  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.users.delete({ user: "me" }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot request deletion of another member's account", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const other = await fixtures.User();

    const err = await waitError(() =>
      client.delete({ user: other.id }, { context: { user } }),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: You can only delete your own account.]`,
    );
    expect(await findUser(other.id)).toMatchObject({
      deletionRequestedAt: null,
    });
  });

  test("schedules deletion after 24 hours and emails the member", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const tasting = await fixtures.Tasting({ createdById: user.id });

    const before = Date.now();
    const result = await client.delete({ user: "me" }, { context: { user } });

    expect(result.deletionScheduledAt).toBeDefined();
    const scheduledAt = new Date(result.deletionScheduledAt!).getTime();
    expect(scheduledAt).toBeGreaterThanOrEqual(
      before + ACCOUNT_DELETION_GRACE_MS - 1000,
    );
    expect(scheduledAt).toBeLessThanOrEqual(
      Date.now() + ACCOUNT_DELETION_GRACE_MS + 1000,
    );

    // Nothing changes until the grace period ends.
    expect(await findUser(user.id)).toMatchObject({
      username: user.username,
      active: true,
      deletedAt: null,
    });
    expect(
      await db.query.tastings.findFirst({ where: eq(tastings.id, tasting.id) }),
    ).toMatchObject({ removedAt: null });

    expect(sendAccountDeletionEmail).toHaveBeenCalledTimes(1);
    expect(sendAccountDeletionEmail).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: user.id }),
      deletionScheduledAt: new Date(result.deletionScheduledAt!),
    });
  });

  test("keeps the schedule when the email fails", async ({ fixtures }) => {
    const user = await fixtures.User();
    sendAccountDeletionEmail.mockRejectedValue(new Error("SMTP down"));

    const result = await client.delete({ user: "me" }, { context: { user } });

    expect(result.deletionScheduledAt).toBeDefined();
    expect(await findUser(user.id)).not.toMatchObject({
      deletionRequestedAt: null,
    });
  });

  test("repeats a request without a second email", async ({ fixtures }) => {
    const user = await fixtures.User();

    const first = await client.delete({ user: "me" }, { context: { user } });
    const current = await findUser(user.id);
    const second = await client.delete(
      { user: "me" },
      { context: { user: current! } },
    );

    expect(second.deletionScheduledAt).toEqual(first.deletionScheduledAt);
    expect(sendAccountDeletionEmail).toHaveBeenCalledTimes(1);
  });

  test("works before the Terms of Service are accepted", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ termsAcceptedAt: null });

    const result = await client.delete({ user: "me" }, { context: { user } });

    expect(result.deletionScheduledAt).toBeDefined();
  });

  describe("Sign in with Apple", () => {
    test("revokes the Apple grant with the code", async ({ fixtures }) => {
      const user = await appleUser(fixtures);

      const result = await client.delete(
        { user: "me", appleAuthorizationCode: "code-1" },
        { context: { user } },
      );

      expect(revokeAppleAuthorization).toHaveBeenCalledWith("code-1");
      expect(result.deletionScheduledAt).toBeDefined();
    });

    test("schedules without a code", async ({ fixtures }) => {
      const user = await appleUser(fixtures);

      const result = await client.delete({ user: "me" }, { context: { user } });

      expect(revokeAppleAuthorization).not.toHaveBeenCalled();
      expect(result.deletionScheduledAt).toBeDefined();
    });

    test("schedules when the server has no Apple credentials", async ({
      fixtures,
    }) => {
      const user = await appleUser(fixtures);
      isAppleRevocationConfigured.mockReturnValue(false);

      const result = await client.delete(
        { user: "me", appleAuthorizationCode: "code-1" },
        { context: { user } },
      );

      expect(revokeAppleAuthorization).not.toHaveBeenCalled();
      expect(result.deletionScheduledAt).toBeDefined();
    });

    test("ignores a code when the account has no Apple identity", async ({
      fixtures,
    }) => {
      const user = await fixtures.User();

      const result = await client.delete(
        { user: "me", appleAuthorizationCode: "code-1" },
        { context: { user } },
      );

      expect(revokeAppleAuthorization).not.toHaveBeenCalled();
      expect(result.deletionScheduledAt).toBeDefined();
    });

    test("schedules nothing when Apple rejects the code", async ({
      fixtures,
    }) => {
      const user = await appleUser(fixtures);
      revokeAppleAuthorization.mockRejectedValue(
        new AppleRevocationError("Apple rejected the request: invalid_grant.", {
          retryable: false,
        }),
      );

      const err = await waitError(() =>
        client.delete(
          { user: "me", appleAuthorizationCode: "code-1" },
          { context: { user } },
        ),
      );
      expect(err).toMatchInlineSnapshot(
        `[Error: Apple did not accept the authorization code. Sign in with Apple again and retry.]`,
      );
      expect(await findUser(user.id)).toMatchObject({
        deletionRequestedAt: null,
      });
      expect(sendAccountDeletionEmail).not.toHaveBeenCalled();
    });

    test("schedules nothing when Apple is unavailable", async ({
      fixtures,
    }) => {
      const user = await appleUser(fixtures);
      revokeAppleAuthorization.mockRejectedValue(
        new AppleRevocationError("Apple could not be reached.", {
          retryable: true,
        }),
      );

      const err = await waitError(() =>
        client.delete(
          { user: "me", appleAuthorizationCode: "code-1" },
          { context: { user } },
        ),
      );
      expect(err).toMatchInlineSnapshot(
        `[Error: Apple could not be reached. Try again later.]`,
      );
      expect(await findUser(user.id)).toMatchObject({
        deletionRequestedAt: null,
      });
    });
  });
});
