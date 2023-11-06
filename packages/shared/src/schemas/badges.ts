import { z } from "zod";

import { BADGE_TYPE_LIST } from "../constants";

export const BadgeTypeEnum = z.enum(BADGE_TYPE_LIST);

export const BadgeSchema = z.object({
  id: z.number(),
  type: BadgeTypeEnum,
  name: z.string(),
  config: z.any(),
});

export const BadgeInputSchema = z.object({
  type: BadgeTypeEnum,
  name: z.string(),
  config: z.record(z.any()),
});
