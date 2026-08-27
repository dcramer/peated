import { createTastingForBadge } from "../testHelpers";
import { EntityTracker } from "./entity";

describe("track", () => {
  test("tracks an Entity once across multiple Bottle relationships", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity();
    const tasting = await createTastingForBadge(fixtures, {
      brand,
      bottler: brand,
      distillers: [brand],
    });
    const impl = new EntityTracker();

    expect(impl.track(tasting)).toMatchInlineSnapshot(`
        [
          {
            "id": ${brand.id},
            "type": "entity",
          },
        ]
      `);
  });
});
