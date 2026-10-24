import { AGE_BUCKET_IDS, RATING_BAND_IDS } from "@peated/server/constants";
import { listResponse, TastingSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/tastings",
    summary: "List tastings",
    description: "Find tastings by bottle, entity, user, or feed",
    operationId: "listTastings",
  })
  .input(
    z
      .object({
        bottle: z.coerce.number().int().positive().optional(),
        entity: z.coerce.number().optional(),
        distiller: z.coerce
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Filter by a distillery of the tasted Bottle. Unlike `entity`, brand and bottler roles do not match.",
          ),
        user: z
          .union([z.coerce.number(), z.literal("me"), z.string()])
          .optional(),
        filter: z.enum(["global", "friends", "local"]).default("global"),
        query: z.coerce
          .string()
          .trim()
          .default("")
          .describe(
            "Search the tasted Bottle's name. Search text only; search operators are not supported.",
          ),
        ratingBand: z
          .enum(RATING_BAND_IDS)
          .optional()
          .describe("Filter by the tasting's rating."),
        age: z
          .enum(AGE_BUCKET_IDS)
          .optional()
          .describe(
            "Filter by the tasted Bottle's stated age range. `unstated` matches Bottles without a stated age.",
          ),
        country: z.coerce
          .string()
          .optional()
          .describe(
            "Filter by the country of the tasted Bottle's brand. Accepts a slug or numeric ID.",
          ),
        region: z.coerce
          .string()
          .optional()
          .describe(
            "Filter by the region of the tasted Bottle's brand. Accepts a slug or numeric ID and requires `country`.",
          ),
        sort: z
          .enum(["-created", "-rating", "name"])
          .default("-created")
          .describe(
            "Order by posting time, newest first; by rating, best first, then newest, with unrated tastings last; or by Bottle name, then newest.",
          ),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(25),
      })
      .strict()
      .default({
        filter: "global",
        query: "",
        sort: "-created",
        cursor: 1,
        limit: 25,
      }),
  )
  // TODO(response-envelope): Return { data, meta } when all list routes use the
  // same wrapper.
  .output(
    listResponse(TastingSchema).extend({
      total: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe(
          "Tastings matching the filters, for one member's list (`user`). Omitted for feeds across members.",
        ),
    }),
  );
