import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import updateCountryStats from "./updateCountryStats";

test("updates totalBottles", async ({ fixtures }) => {
  const country1 = await fixtures.Country();
  const country2 = await fixtures.Country();

  const entity1 = await fixtures.Entity({ countryId: country1.id });
  const entity2 = await fixtures.Entity({ countryId: country1.id });
  const entity3 = await fixtures.Entity({ countryId: country2.id });

  await fixtures.Bottle({ brandId: entity1.id });
  await fixtures.Bottle({ brandId: entity2.id, bottlerId: entity1.id });
  await fixtures.Bottle({ brandId: entity3.id });
  await fixtures.Bottle({ distillerIds: [entity1.id, entity2.id] });

  updateCountryStats({ countryId: country1.id });

  const [newCountry1] = await db
    .select()
    .from(countries)
    .where(eq(countries.id, country1.id));
  expect(newCountry1).toBeDefined();
  expect(newCountry1.totalBottles).toEqual(3);
});
