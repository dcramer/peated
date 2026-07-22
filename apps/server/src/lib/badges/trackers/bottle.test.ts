import { createTastingForBadge, useGenericBadgeTarget } from "../testHelpers";
import { BottleTracker } from "./bottle";

describe("track", () => {
  test("tracks bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures);
    if (tasting.identity.kind !== "bottle") {
      throw new Error("Expected an exact Bottle fixture");
    }
    const impl = new BottleTracker();

    expect(impl.track(tasting)).toMatchInlineSnapshot(`
        [
          {
            "id": ${tasting.identity.bottleId},
            "type": "bottle",
          },
        ]
      `);
  });

  test("does not track a representative for a generic target", async ({
    fixtures,
  }) => {
    const exact = await createTastingForBadge(fixtures);
    const tasting = await useGenericBadgeTarget(exact.id);
    const impl = new BottleTracker();

    expect(impl.track(tasting)).toEqual([]);
  });
});
