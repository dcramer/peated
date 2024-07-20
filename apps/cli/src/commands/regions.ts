import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { runJob } from "@peated/server/worker/client";
import slugify from "@sindresorhus/slugify";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

const LOCATION_DATA = [
  {
    name: "Scotland",
    regions: ["Islay", "Highland", "Lowland", "Cambeltown", "Speyside"],
  },
  { name: "Ireland", regions: [] },
  {
    name: "United States",
    regions: [
      "Alabama",
      "Alaska",
      "Arizona",
      "Arkansas",
      "California",
      "Colorado",
      "Connecticut",
      "Delaware",
      "District Of Columbia",
      "Florida",
      "Georgia",
      "Guam",
      "Hawaii",
      "Idaho",
      "Illinois",
      "Indiana",
      "Iowa",
      "Kansas",
      "Kentucky",
      "Louisiana",
      "Maine",
      "Maryland",
      "Massachusetts",
      "Michigan",
      "Minnesota",
      "Mississippi",
      "Missouri",
      "Montana",
      "Nebraska",
      "Nevada",
      "New Hampshire",
      "New Jersey",
      "New Mexico",
      "New York",
      "North Carolina",
      "North Dakota",
      "Ohio",
      "Oklahoma",
      "Oregon",
      "Pennsylvania",
      "Puerto Rico",
      "Rhode Island",
      "South Carolina",
      "South Dakota",
      "Tennessee",
      "Texas",
      "Utah",
      "Vermont",
      "Virginia",
      "Washington",
      "West Virginia",
      "Wisconsin",
      "Wyoming",
    ],
  },
  {
    name: "Canada",
    regions: [
      "Alberta",
      "British Columbia",
      "Manitoba",
      "New Brunswick",
      "Newfoundland and Labrador",
      "Nova Scotia",
      "Northwest Territories",
      "Nunavut",
      "Ontario",
      "Prince Edward Island",
      "Québec",
      "Saskatchewan",
      "Yukon",
    ],
  },
  {
    name: "Japan",
    regions: [
      "Aichi",
      "Akita",
      "Aomori",
      "Chiba",
      "Ehime",
      "Fukuoka",
      "Fukushima",
      "Fukui",
      "Gifu",
      "Gunma",
      "Hokkaido",
      "Hiroshima",
      "Hyogo",
      "Ibaraki",
      "Ishikawa",
      "Iwate",
      "Kagoshima",
      "Kagawa",
      "Kumamoto",
      "Kanagawa",
      "Kochi",
      "Kyoto",
      "Mie",
      "Miyagi",
      "Miyazaki",
      "Nara",
      "Nagano",
      "Nagasaki",
      "Niigata",
      "Oita",
      "Okinawa",
      "Okayama",
      "Osaka",
      "Saga",
      "Shiga",
      "Shimane",
      "Saitama",
      "Shizuoka",
      "Tochigi",
      "Tottori",
      "Tokushima",
      "Tokyo",
      "Toyama",
      "Wakayama",
      "Yamaguchi",
      "Yamanashi",
      "Yamagata",
    ],
  },
];

const subcommand = program.command("regions");

subcommand
  .command("generate-descriptions")
  .description("Generate region descriptions")
  .argument("[regionIds...]")
  .option("--only-missing")
  .action(async (regionIds, options) => {
    const step = 1000;
    const baseQuery = db
      .select({ id: regions.id })
      .from(regions)
      .where(
        regionIds.length
          ? inArray(regions.id, regionIds)
          : options.onlyMissing
            ? isNull(regions.description)
            : undefined,
      )
      .orderBy(asc(regions.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Generating description for region ${id}.`);
        await runJob("GenerateRegionDetails", { regionId: id });
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("geocode-locations")
  .description("Geocode regions")
  .option("--only-missing")
  .action(async (options) => {
    const step = 1000;
    const baseQuery = db
      .select({ id: regions.id })
      .from(regions)
      .where(and(options.onlyMissing ? isNull(regions.location) : undefined))
      .orderBy(asc(regions.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id } of query) {
        console.log(`Geocoding location for Region ${id}.`);
        await runJob("GeocodeRegionLocation", { regionId: id });
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand
  .command("load-data")
  .description("Load region data")
  .action(async (options) => {
    for (const countryData of LOCATION_DATA) {
      const [country] = await db
        .select()
        .from(countries)
        .where(eq(countries.name, countryData.name));
      if (!country) {
        throw new Error(`Country not found: ${countryData.name}`);
      }

      for (const regionName of countryData.regions) {
        const [region] = await db
          .select()
          .from(regions)
          .where(
            and(
              eq(regions.countryId, country.id),
              eq(regions.name, regionName),
            ),
          );
        if (!region) {
          await db.insert(regions).values({
            name: regionName,
            slug: slugify(regionName),
            countryId: country.id,
          });
        }
      }
    }
  });

subcommand.command("fix-stats").action(async (options) => {
  const step = 1000;
  const baseQuery = db
    .select({ id: regions.id })
    .from(regions)
    .orderBy(asc(regions.id));

  let hasResults = true;
  let offset = 0;
  while (hasResults) {
    hasResults = false;
    const query = await baseQuery.offset(offset).limit(step);
    for (const { id } of query) {
      console.log(`Updating stats for Region ${id}.`);
      await runJob("UpdateRegionStats", { regionId: id });
      hasResults = true;
    }
    offset += step;
  }
});
