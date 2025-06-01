import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /bottles/:bottle", () => {
  test("deletes bottle", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();

    const data = await routerClient.bottles.delete(
      { bottle: bottle.id },
      {
        context: { user },
      }
    );
    expect(data).toEqual({});

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(newBottle).toBeUndefined();
  });

  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();

    const err = await waitError(
      routerClient.bottles.delete({ bottle: bottle.id }, { context: { user } })
    );
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });
});
