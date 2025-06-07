import { bottles } from "@peated/server/db/schema";
import { gte, lte } from "drizzle-orm";
import type { z } from "zod";
import type { TastingWithRelations } from "../../types";
import { Check } from "../base";
import { AgeCheckConfigSchema } from "./schema";

export class AgeCheck extends Check {
  schema = AgeCheckConfigSchema;

  buildWhereClause(config: z.infer<typeof AgeCheckConfigSchema>) {
    return [
      gte(bottles.statedAge, config.minAge),
      lte(bottles.statedAge, config.maxAge),
    ];
  }

  test(
    config: z.infer<typeof AgeCheckConfigSchema>,
    tasting: TastingWithRelations
  ) {
    if (!tasting.bottle.statedAge) return false;
    return (
      tasting.bottle.statedAge >= config.minAge &&
      tasting.bottle.statedAge <= config.maxAge
    );
  }
}
