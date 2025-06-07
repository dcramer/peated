import { EntityTypeEnum } from "@peated/server/schemas/common";
import { z } from "zod";

export const EntityCheckConfigSchema = z.object({
  entity: z.number(),
  type: EntityTypeEnum.nullable().default(null),
});

export type EntityCheckConfig = z.infer<typeof EntityCheckConfigSchema>;
