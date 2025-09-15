import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("POST /auth/tos/accept", () => {
  test("requires auth", async () => {
    const err = await waitError(routerClient.auth.acceptTos());
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("sets tosAcceptedAt", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: true });

    // auth headers
    const headers = await fixtures.AuthenticatedHeaders({ user });

    const data = await routerClient.auth.acceptTos({}, { headers });

    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));

    expect(updated.tosAcceptedAt).not.toBeNull();
    expect(data.id).toEqual(user.id);
  });
});
