import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { routerClient } from "../router";

describe("POST /bottles/upsert", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.bottleUpsert({
        name: "Delicious Wood",
        brand: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[ORPCError: UNAUTHORIZED]`);
  });

  test("creates a new bottle", async ({ fixtures }) => {
    const modUser = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity();

    const data = await routerClient.bottleUpsert(
      {
        name: "Delicious Wood",
        brand: brand.id,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.id));
    expect(bottle.name).toEqual("Delicious Wood");
  });

  test("returns existing bottle when identical", async ({ fixtures }) => {
    const modUser = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      name: "Delicious Wood",
      brandId: brand.id,
    });

    const data = await routerClient.bottleUpsert(
      {
        name: "Delicious Wood",
        brand: brand.id,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();
    expect(data.id).toEqual(bottle.id);
  });
});
