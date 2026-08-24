import { eq } from "drizzle-orm";
import { db } from "../index";
import { entities } from "./entities";

describe("Entity relations", () => {
  test("loads region through regionId", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const firstRegion = await fixtures.Region({ countryId: country.id });
    const region =
      firstRegion.id === country.id
        ? await fixtures.Region({ countryId: country.id })
        : firstRegion;
    const entity = await fixtures.Entity({
      countryId: country.id,
      regionId: region.id,
    });

    expect(region.id).not.toBe(country.id);

    const loaded = await db.query.entities.findFirst({
      where: eq(entities.id, entity.id),
      with: { region: true },
    });

    expect(loaded?.region?.id).toBe(region.id);
  });
});
