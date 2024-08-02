import { bottles } from "@peated/server/db/schema";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import type { TastingWithRelations } from "../types";
import { Check } from "./base";

export const BottleCheckConfigSchema = z.object({
  bottle: z.array(z.number()).min(1, "At least one bottle is required."),
});

export class BottleCheck extends Check {
  schema = BottleCheckConfigSchema;

  buildWhereClause(config: z.infer<typeof BottleCheckConfigSchema>) {
    return [inArray(bottles.id, config.bottle)];
  }

  test(
    config: z.infer<typeof BottleCheckConfigSchema>,
    tasting: TastingWithRelations,
  ) {
    return config.bottle.includes(tasting.bottle.id);
  }
}
