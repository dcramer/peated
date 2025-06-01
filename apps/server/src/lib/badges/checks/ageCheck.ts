import { bottles } from "@peated/server/db/schema";
import { gte, lte } from "drizzle-orm";
import { z } from "zod";
import type { TastingWithRelations } from "../types";
import { Check } from "./base";

export const AgeCheckConfigSchema = z.object({
  minAge: z.number().min(0).max(100),
  maxAge: z.number().min(0).max(100),
});

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
