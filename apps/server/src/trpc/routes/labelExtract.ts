import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { extractFromImage, extractFromText } from "../../agents/labelExtractor";
import { publicProcedure } from "../../trpc";

export default publicProcedure
  .input(
    z
      .object({
        imageUrl: z.string().optional(),
        label: z.string().optional(),
      })
      .refine(
        (data) => data.imageUrl !== undefined || data.label !== undefined,
        {
          message: "Either imageUrl or label must be provided",
        },
      ),
  )
  .mutation(async ({ input }) => {
    try {
      if (input.imageUrl) {
        return await extractFromImage(input.imageUrl);
      }
      if (input.label) {
        return await extractFromText(input.label);
      }
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Either imageUrl or label must be provided",
      });
    } catch (error) {
      console.error(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to extract label information",
        cause: error,
      });
    }
  });
