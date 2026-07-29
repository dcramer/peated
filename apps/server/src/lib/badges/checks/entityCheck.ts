import { EntityTypeEnum } from "@peated/server/schemas/common";
import { z } from "zod";
import type { BadgeTasting } from "../types";

export const EntityCheckConfigSchema = z.object({
  entity: z.number(),
  type: EntityTypeEnum.nullable().default(null),
});

export class EntityCheck {
  test(config: z.infer<typeof EntityCheckConfigSchema>, tasting: BadgeTasting) {
    const matches: number[] = [];
    if (config.type === "distiller" || !config.type) {
      matches.push(...tasting.identity.distillers.map(({ id }) => id));
    }
    if (config.type === "brand" || !config.type) {
      matches.push(tasting.identity.brand.id);
    }
    if (config.type === "bottler" || !config.type) {
      if (tasting.identity.bottler) {
        matches.push(tasting.identity.bottler.id);
      }
    }

    return matches.includes(config.entity);
  }
}
