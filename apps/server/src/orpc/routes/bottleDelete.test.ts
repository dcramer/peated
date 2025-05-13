import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { db } from "../../db";
import { bottles } from "../../db/schema";
import { routerClient } from "../router";

describe("DELETE /bottles/:id", () => {
  test("deletes bottle", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();

    const data = await routerClient.bottleDelete(bottle.id, {
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
      routerClient.bottleDelete(bottle.id, {
        context: { user },
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });
});
