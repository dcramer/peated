import { detailsResponse, RegionSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/countries/{country}/regions/{region}",
    summary: "Get region details",
    description: "Get a region by its country and URL name",
    operationId: "getRegion",
  })
  .input(
    z.object({
      region: z.string(),
      country: z.string(),
    }),
  )
  // TODO(response-envelope): Return { data: ... } when all detail routes use the
  // same wrapper.
  .output(detailsResponse(RegionSchema));
