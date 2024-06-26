import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { pushJob } from "@peated/server/jobs/client";
import { and, asc, isNull } from "drizzle-orm";

const subcommand = program.command("locations");

subcommand
  .command("geocode-countries")
  .description("Geocode countries")
  .option("--only-missing")
  .action(async (options) => {
    const step = 1000;
    const baseQuery = db
      .select({ id: countries.id })
      .from(countries)
      .where(and(options.onlyMissing ? isNull(countries.location) : undefined))
      .orderBy(asc(countries.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Geocoding location for Country ${id}.`);
        await pushJob("GeocodeCountryLocation", { countryId: id });
        hasResults = true;
      }
      offset += step;
    }
  });
