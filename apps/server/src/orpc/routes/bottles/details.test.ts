import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottles/:bottle", () => {
  test("get bottle by id", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.bottles.details({
      bottle: bottle.id,
    });
    expect(data.id).toEqual(bottle.id);
  });

  test("errors on invalid bottle", async () => {
    const err = await waitError(routerClient.bottles.details({ bottle: 1 }));
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  test("gets bottle with tombstone", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Delicious Wood" });
    await db.insert(bottleTombstones).values({
      bottleId: 999,
      newBottleId: bottle1.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const data = await routerClient.bottles.details({ bottle: 999 });
    expect(data.id).toEqual(bottle1.id);
  });
});
