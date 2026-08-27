import { BottleEntityRoleEnum } from "@peated/server/schemas/common";
import { z } from "zod";
import type { BadgeTasting } from "../types";

export const EntityCheckConfigSchema = z.object({
  entity: z.number(),
  role: BottleEntityRoleEnum.nullable().default(null),
});

export class EntityCheck {
  test(config: z.infer<typeof EntityCheckConfigSchema>, tasting: BadgeTasting) {
    const matches: number[] = [];
    if (config.role === "distiller" || !config.role) {
      matches.push(...tasting.identity.distillers.map(({ id }) => id));
    }
    if (config.role === "brand" || !config.role) {
      matches.push(tasting.identity.brand.id);
    }
    if (config.role === "bottler" || !config.role) {
      if (tasting.identity.bottler) {
        matches.push(tasting.identity.bottler.id);
      }
    }

    return matches.includes(config.entity);
  }
}
