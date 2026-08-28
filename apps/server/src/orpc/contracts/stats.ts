import { z } from "zod";
import { contract } from "./base";

export default contract
  .route({
    method: "GET",
    path: "/stats",
    summary: "Get public statistics",
    description: "Get current catalog, tasting, and review counts",
    operationId: "getStats",
  })
  .output(
    z.object({
      asOf: z.string().datetime().describe("Time when the counts were read"),
      bottles: z
        .number()
        .int()
        .nonnegative()
        .describe("Active independently complete Bottles"),
      brands: z.number().int().nonnegative().describe("Brands"),
      distilleries: z.number().int().nonnegative().describe("Distilleries"),
      bottlers: z.number().int().nonnegative().describe("Bottlers"),
      blenders: z.number().int().nonnegative().describe("Blenders"),
      companies: z.number().int().nonnegative().describe("Companies"),
      tastings: z
        .number()
        .int()
        .nonnegative()
        .describe("User-authored tasting records"),
      memberReviews: z
        .number()
        .int()
        .nonnegative()
        .describe("Member reviews contributing to active Bottle summaries"),
      externalReviews: z
        .number()
        .int()
        .nonnegative()
        .describe("Public external reviews attached to active Bottles"),
    }),
  );
