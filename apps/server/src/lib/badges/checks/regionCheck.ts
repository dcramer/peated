import {
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { TastingWithRelations } from "../types";
import { BaseBottleCheck } from "./base";

// TODO: validate params
export const RegionCheckConfigSchema = z.object({
  country: z.number(),
  region: z.number().nullable().default(null),
});

export class RegionCheck extends BaseBottleCheck {
  schema = RegionCheckConfigSchema;

  buildWhereClause(config: z.infer<typeof RegionCheckConfigSchema>) {
    return [
      config.region
        ? sql`EXISTS (
        SELECT FROM
        ${entities}
        WHERE (
          ${entities.id} = ${bottles.brandId}
          OR ${entities.id} IN (
            SELECT ${bottlesToDistillers.distillerId} FROM ${bottlesToDistillers}
            WHERE ${bottlesToDistillers.distillerId} = ${entities.id}
            AND ${bottlesToDistillers.bottleId} = ${bottles.id}
          )
        ) AND ${entities.countryId} = ${config.country}
         AND ${entities.regionId} = ${config.region})`
        : sql`EXISTS (
      SELECT FROM
      ${entities}
      WHERE (
        ${entities.id} = ${bottles.brandId}
        OR ${entities.id} IN (
          SELECT ${bottlesToDistillers.distillerId} FROM ${bottlesToDistillers}
          WHERE ${bottlesToDistillers.distillerId} = ${entities.id}
          AND ${bottlesToDistillers.bottleId} = ${bottles.id}
        )
      ) AND ${entities.countryId} = ${config.country})`,
    ];
  }

  test(
    config: z.infer<typeof RegionCheckConfigSchema>,
    tasting: TastingWithRelations,
  ) {
    const { brand, bottlesToDistillers } = tasting.bottle;

    const { region, country } = config;
    if (country === brand.countryId && (!region || region === brand.regionId))
      return true;

    if (
      bottlesToDistillers.find(
        ({ distiller: d }) =>
          country === d.countryId && (!region || region === d.regionId),
      )
    )
      return true;

    return false;
  }
}
