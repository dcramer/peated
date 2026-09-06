import { ExternalSiteKeySchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export const ActiveCriticSchema = z
  .object({
    site: z
      .object({
        type: ExternalSiteKeySchema.describe("Stable key for the review site"),
        name: z.string().trim().min(1).describe("Name of the review site"),
        imageUrl: z.string().url().nullable().describe("Site icon URL"),
      })
      .strict(),
    latestReview: z
      .object({
        bottleName: z
          .string()
          .trim()
          .min(1)
          .describe("Full name of the Bottle reviewed"),
        publishedAt: z
          .string()
          .datetime()
          .describe("Publication time of the review"),
        url: z.string().trim().min(1).describe("URL to the original review"),
      })
      .strict(),
  })
  .strict();

export default contract
  .route({
    method: "GET",
    path: "/external-reviews/active-critics",
    summary: "List active critics",
    description:
      "List review sites in Peated's activity order. Each site includes the public review used to place it.",
    operationId: "listActiveCritics",
  })
  .input(
    z
      .object({
        limit: z.coerce.number().int().gte(1).lte(10).default(5),
      })
      .strict()
      .default({ limit: 5 }),
  )
  .output(z.array(ActiveCriticSchema));
