import { detailsResponse, TastingSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/tastings/{tasting}",
    summary: "Get tasting details",
    description: "Get one tasting",
    operationId: "getTasting",
  })
  .input(z.object({ tasting: z.coerce.number() }))
  // TODO(response-envelope): Return { data: ... } when all detail routes use the
  // same wrapper.
  .output(detailsResponse(TastingSchema));
