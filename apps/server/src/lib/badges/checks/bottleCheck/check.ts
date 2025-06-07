import { bottles } from "@peated/server/db/schema";
import { inArray } from "drizzle-orm";
import type { z } from "zod";
import type { TastingWithRelations } from "../../types";
import { Check } from "../base";
import { BottleCheckConfigSchema } from "./schema";

export class BottleCheck extends Check {
  schema = BottleCheckConfigSchema;

  buildWhereClause(config: z.infer<typeof BottleCheckConfigSchema>) {
    return [inArray(bottles.id, config.bottle)];
  }

  test(
    config: z.infer<typeof BottleCheckConfigSchema>,
    tasting: TastingWithRelations
  ) {
    return config.bottle.includes(tasting.bottle.id);
  }
}
