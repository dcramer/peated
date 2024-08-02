import { createTastingForBadge } from "../testHelpers";
import { BottleTracker } from "./bottle";

describe("track", () => {
  test("tracks bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures);
    const impl = new BottleTracker();

    expect(impl.track(tasting)).toMatchInlineSnapshot(`
        [
          {
            "id": ${tasting.bottle.id},
            "type": "bottle",
          },
        ]
      `);
  });
});
