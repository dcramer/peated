import { zodResolver as hookFormZodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/** Adapts the Zod resolver to forms that use the schema's parsed output type. */
export function zodResolver<TOutput extends FieldValues>(
  schema: z.ZodType<TOutput>,
): Resolver<TOutput> {
  // SAFETY: Form defaults satisfy the parsed schema, so resolver inputs use its output contract.
  const parsedFormSchema = schema as z.ZodType<TOutput, TOutput>;
  return hookFormZodResolver(parsedFormSchema);
}
