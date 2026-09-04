import { eq } from "drizzle-orm";
import { db } from "../index";
import { entities } from "./entities";

describe("Entity relations", () => {
  test("loads region through regionId", async ({ fixtures }) => {
    const country = await fixtures.Country({
      id: 101,
      name: "Entity Relation Country",
      slug: "entity-relation-country",
    });
    await fixtures.Region({
      id: country.id,
      name: "Country ID Decoy",
      slug: "country-id-decoy",
      countryId: country.id,
    });
    const region = await fixtures.Region({
      id: 202,
      name: "Entity Relation Region",
      slug: "entity-relation-region",
      countryId: country.id,
    });
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
