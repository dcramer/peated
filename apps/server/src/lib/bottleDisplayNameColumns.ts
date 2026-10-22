import {
  bottleGroups,
  bottles,
  bottleSeries,
  entities,
} from "@peated/server/db/schema";
import { sql } from "drizzle-orm";

/**
 * Columns `formatBottleDisplayName` needs, for a query that selects from
 * `bottles`. Brand, Series, and group names are primary-key lookups in the
 * same query, so lists stay one query.
 */
export const bottleDisplayNameColumns = {
  name: bottles.name,
  edition: bottles.edition,
  statedAge: bottles.statedAge,
  vintageYear: bottles.vintageYear,
  releaseYear: bottles.releaseYear,
  abv: bottles.abv,
  singleCask: bottles.singleCask,
  caskStrength: bottles.caskStrength,
  brandName: sql<string>`(SELECT ${entities.name} FROM ${entities} WHERE ${entities.id} = ${bottles.brandId})`,
  brandShortName: sql<
    string | null
  >`(SELECT ${entities.shortName} FROM ${entities} WHERE ${entities.id} = ${bottles.brandId})`,
  seriesName: sql<
    string | null
  >`(SELECT ${bottleSeries.name} FROM ${bottleSeries} WHERE ${bottleSeries.id} = ${bottles.seriesId})`,
  groupName: sql<
    string | null
  >`(SELECT ${bottleGroups.name} FROM ${bottleGroups} WHERE ${bottleGroups.id} = ${bottles.groupId})`,
};

type BottleDisplayNameRow = {
  name: string;
  edition: string | null;
  statedAge: number | null;
  vintageYear: number | null;
  releaseYear: number | null;
  abv: number | null;
  singleCask: boolean | null;
  caskStrength: boolean | null;
  brandName: string;
  brandShortName: string | null;
  seriesName: string | null;
  groupName: string | null;
};

/** Shapes `bottleDisplayNameColumns` for `BottleDisplayNameSourceSchema`. */
export function toBottleDisplayNameSource({
  brandName,
  brandShortName,
  seriesName,
  groupName,
  ...bottle
}: BottleDisplayNameRow) {
  return {
    ...bottle,
    brand: { name: brandName, shortName: brandShortName },
    series: seriesName === null ? null : { name: seriesName },
    group: groupName === null ? null : { name: groupName },
  };
}
