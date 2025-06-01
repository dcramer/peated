import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { runJob } from "@peated/server/worker/client";
import { and, asc, inArray, isNull, or } from "drizzle-orm";

const subcommand = program.command("countries");

subcommand
  .command("generate-descriptions")
  .description("Generate country descriptions")
  .argument("[countryIds...]")
  .option("--only-missing")
  .action(async (countryIds, options) => {
    const step = 1000;
    const baseQuery = db
      .select({ id: countries.id })
      .from(countries)
      .where(
        countryIds.length
          ? inArray(countries.id, countryIds)
          : options.onlyMissing
            ? or(isNull(countries.description), isNull(countries.summary))
            : undefined
      )
      .orderBy(asc(countries.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Generating description for country ${id}.`);
        await runJob("GenerateCountryDetails", { countryId: id });
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("geocode-locations")
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
        await runJob("GeocodeCountryLocation", { countryId: id });
        hasResults = true;
      }
      offset += step;
    }
  });
