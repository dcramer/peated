import { createTastingForBadge } from "../testHelpers";
import { RegionTracker } from "./region";

describe("track", () => {
  test("tracks region", async ({ fixtures }) => {
    const region = await fixtures.Region();
    const brand = await fixtures.Entity({
      countryId: region.countryId,
      regionId: region.id,
    });
    const tasting = await createTastingForBadge(fixtures, {
      brand,
      distillers: [],
    });
    const impl = new RegionTracker();

    expect(impl.track(tasting)).toMatchInlineSnapshot(`
        [
          {
            "id": ${region.id},
            "type": "region",
          },
        ]
      `);
  });
});
