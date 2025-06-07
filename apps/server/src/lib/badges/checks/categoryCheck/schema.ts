import { CategoryEnum } from "@peated/server/schemas/common";
import { z } from "zod";

export const CategoryCheckConfigSchema = z.object({
  category: z.array(CategoryEnum).min(1, "At least one category is required."),
});

export type CategoryCheckConfig = z.infer<typeof CategoryCheckConfigSchema>;
