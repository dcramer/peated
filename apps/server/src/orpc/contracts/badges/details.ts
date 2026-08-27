import { BadgeSchema, detailsResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/badges/{badge}",
    summary: "Get badge details",
    description: "Get a badge",
    operationId: "getBadge",
  })
  .input(z.object({ badge: z.coerce.number() }))
  .output(detailsResponse(BadgeSchema));
