import { ORPCError } from "@orpc/server";
import {
  extractFromImage,
  extractFromText,
} from "@peated/server/agents/labelExtractor";
import { procedure } from "@peated/server/orpc";
import { z } from "zod";

const InputSchema = z
  .object({
    imageUrl: z.string().optional(),
    label: z.string().optional(),
  })
  .refine((data) => data.imageUrl !== undefined || data.label !== undefined, {
    message: "Either imageUrl or label must be provided",
  });

// TODO: Define proper output schema based on what extractFromImage/extractFromText return
const OutputSchema = z.object({
  brand: z.string().optional(),
  expression: z.string().optional(),
  category: z.string().optional(),
  statedAge: z.number().optional(),
  abv: z.number().optional(),
  caskType: z.string().optional(),
  series: z.string().optional(),
  edition: z.string().optional(),
});

export default procedure
  .route({ method: "POST", path: "/ai/extract-labels" })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({ input }) {
    try {
      if (input.imageUrl) {
        return await extractFromImage(input.imageUrl);
      }
      if (input.label) {
        return await extractFromText(input.label);
      }
      throw new ORPCError("BAD_REQUEST", {
        message: "Either imageUrl or label must be provided",
      });
    } catch (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to extract label information",
      });
    }
  });
