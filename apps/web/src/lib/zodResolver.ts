import { zodResolver as hookFormZodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/** Adapts the Zod 4-aware resolver while preserving parsed-value form types. */
export function zodResolver<TSchema extends z.ZodType<FieldValues>>(
  schema: TSchema,
): Resolver<z.infer<TSchema>> {
  return hookFormZodResolver(schema as never) as unknown as Resolver<
    z.infer<TSchema>
  >;
}
