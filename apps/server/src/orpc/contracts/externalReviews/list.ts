import {
  ExternalReviewSchema,
  ExternalSiteTypeEnum,
  listResponse,
} from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const DEFAULT_SORT = "recent";
const SORT_OPTIONS = ["recent", "name"] as const;

export default contract
  .route({
    method: "GET",
    path: "/external-reviews",
    summary: "List external reviews",
    description: "Find external reviews by bottle, site, or name",
    operationId: "listExternalReviews",
  })
  .input(
    z
      .object({
        site: ExternalSiteTypeEnum.optional(),
        bottle: z.coerce.number().gte(1).optional(),
        query: z.string().default(""),
        onlyUnknown: z.coerce.boolean().optional(),
        sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .strict()
      .default({
        query: "",
        sort: DEFAULT_SORT,
        cursor: 1,
        limit: 100,
      }),
  )
  // TODO(response-envelope): Return { data, meta } when all list routes use the
  // same wrapper.
  .output(listResponse(ExternalReviewSchema));
