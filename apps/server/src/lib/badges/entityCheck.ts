import { bottles, bottlesToDistillers } from "@peated/server/db/schema";
import { EntityTypeEnum } from "@peated/server/schemas/common";
import type { SQL } from "drizzle-orm";
import { eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { Check, type TastingWithRelations } from "./base";

export const EntityCheckConfigSchema = z.object({
  entity: z.number(),
  type: EntityTypeEnum.nullable().default(null),
});

export class EntityCheck extends Check {
  schema = EntityCheckConfigSchema;

  buildWhereClause(config: z.infer<typeof EntityCheckConfigSchema>) {
    const where = [];
    if (config.type === "distiller") {
      where.push(
        sql`EXISTS(
        SELECT FROM ${bottlesToDistillers}
        WHERE ${bottlesToDistillers.distillerId} = ${config.entity}
        AND ${bottlesToDistillers.bottleId} = ${bottles.id}
      )`,
      );
    } else if (config.type === "brand") {
      where.push(eq(bottles.brandId, config.entity));
    } else if (config.type === "bottler") {
      where.push(eq(bottles.bottlerId, config.entity));
    } else {
      where.push(
        or(
          eq(bottles.brandId, config.entity),
          eq(bottles.bottlerId, config.entity),
          sql`EXISTS(
          SELECT FROM ${bottlesToDistillers}
          WHERE ${bottlesToDistillers.distillerId} = ${config.entity}
          AND ${bottlesToDistillers.bottleId} = ${bottles.id})`,
        ) as SQL,
      );
    }
    return where;
  }

  test(
    config: z.infer<typeof EntityCheckConfigSchema>,
    tasting: TastingWithRelations,
  ) {
    let matches: number[] = [];
    if (config.type === "distiller" || !config.type) {
      matches.push(
        ...tasting.bottle.bottlesToDistillers.map(
          ({ distillerId }) => distillerId,
        ),
      );
    }
    if (config.type === "brand" || !config.type) {
      matches.push(tasting.bottle.brandId);
    }
    if (config.type === "bottler" || !config.type) {
      if (tasting.bottle.bottlerId) {
        matches.push(tasting.bottle.bottlerId);
      }
    }

    return matches.includes(config.entity);
  }
}
