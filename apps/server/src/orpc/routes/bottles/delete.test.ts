import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /bottles/:id", () => {
  test("deletes bottle", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();

    const data = await routerClient.bottles.delete(bottle.id, {
      context: { user },
    });
    expect(data).toEqual({});

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(newBottle).toBeUndefined();
  });

  test("cannot delete without admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ createdById: user.id });

    const err = await waitError(() =>
      routerClient.bottles.delete(bottle.id, {
        context: { user },
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
