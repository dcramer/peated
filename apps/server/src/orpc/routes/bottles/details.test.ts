import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /bottles/:bottle", () => {
  test("get bottle by id", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.bottles.details({
      bottle: bottle.id,
    });
    expect(data.id).toEqual(bottle.id);
    expect(data.group?.id).toEqual(bottle.groupId);
    expect("createdBy" in data).toBe(false);
  });

  test("uses the Bottle's own image", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "https://example.com/bottle.png",
    });
    const data = await routerClient.bottles.details({
      bottle: bottle.id,
    });

    expect(data.imageUrl).toBe("https://example.com/bottle.png");
    expect("displayImageUrl" in data).toBe(false);
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

  test("counts people through direct Bottle identity", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "Selected Bottle" });
    const sibling = await fixtures.BottleGroupMember({
      groupId: bottle.groupId,
      edition: "Sibling Edition",
      releaseYear: 2026,
    });
    const exactPerson = await fixtures.User();
    const siblingPerson = await fixtures.User();
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: exactPerson.id,
    });
    await fixtures.Tasting({
      bottleId: sibling.id,
      createdById: siblingPerson.id,
    });

    const [selectedDetails, siblingDetails] = await Promise.all([
      routerClient.bottles.details({ bottle: bottle.id }),
      routerClient.bottles.details({ bottle: sibling.id }),
    ]);

    expect(selectedDetails.people).toBe(1);
    expect(siblingDetails.people).toBe(1);
  });

  test("selects lastPrice through direct Bottle identity", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const directPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Direct Bottle detail price",
      updatedAt: new Date(Date.now() - 1_000),
    });
    await fixtures.StorePrice({
      bottleId: otherBottle.id,
      name: "Newer unrelated price",
      updatedAt: new Date(),
    });

    const data = await routerClient.bottles.details({ bottle: bottle.id });

    expect(data.lastPrice?.id).toBe(directPrice.id);
    expect(data.lastPrice?.bottle?.id).toBe(bottle.id);
    expect(data.lastPrice).not.toHaveProperty("target");
  });

  test("returns an alias-propagated price through direct Bottle identity", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const directPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Alias-propagated detail price",
    });

    const data = await routerClient.bottles.details({ bottle: bottle.id });

    expect(data.lastPrice?.id).toBe(directPrice.id);
    expect(data.lastPrice?.bottle?.id).toBe(bottle.id);
  });
});
