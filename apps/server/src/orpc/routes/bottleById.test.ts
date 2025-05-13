import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "../router";

describe("GET /bottles/:id", () => {
  test("gets bottle", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Delicious Wood" });
    await fixtures.Bottle({ name: "Something Else" });

    const data = await routerClient.bottleById(bottle1.id);
    expect(data.id).toEqual(bottle1.id);
  });

  test("errors on invalid bottle", async () => {
    const err = await waitError(routerClient.bottleById(1));
    expect(err).toMatchInlineSnapshot();
  });

  test("gets bottle with tombstone", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Delicious Wood" });
    await db.insert(bottleTombstones).values({
      bottleId: 999,
      newBottleId: bottle1.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const data = await routerClient.bottleById(999);
    expect(data.id).toEqual(bottle1.id);
  });
});
