import { createTastingForBadge } from "../testHelpers";
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
});
