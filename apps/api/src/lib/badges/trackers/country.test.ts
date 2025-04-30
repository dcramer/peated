import { createTastingForBadge } from "../testHelpers";
import { CountryTracker } from "./country";

describe("track", () => {
  test("tracks country", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const brand = await fixtures.Entity({ countryId: country.id });
    const tasting = await createTastingForBadge(fixtures, {
      brand,
      distillers: [],
    });
    const impl = new CountryTracker();

    expect(impl.track(tasting)).toMatchInlineSnapshot(`
        [
          {
            "id": ${country.id},
            "type": "country",
          },
        ]
      `);
  });
});
