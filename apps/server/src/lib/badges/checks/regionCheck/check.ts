import {
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import type { TastingWithRelations } from "../../types";
import { Check } from "../base";
import { RegionCheckConfigSchema } from "./schema";

export class RegionCheck extends Check {
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
    tasting: TastingWithRelations
  ) {
    const { brand, bottlesToDistillers } = tasting.bottle;

    const { region, country } = config;
    if (country === brand.countryId && (!region || region === brand.regionId))
      return true;

    if (
      bottlesToDistillers.find(
        ({ distiller: d }) =>
          country === d.countryId && (!region || region === d.regionId)
      )
    )
      return true;

    return false;
  }
}
