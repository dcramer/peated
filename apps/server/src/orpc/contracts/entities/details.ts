import { detailsResponse, EntitySchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}",
    summary: "Get entity details",
    description: "Get a brand, distillery, bottler, blender, or company",
    operationId: "getEntity",
  })
  .input(z.object({ entity: z.coerce.number() }))
  // TODO(response-envelope): Return { data: ... } when all detail routes use the
  // same wrapper.
  .output(detailsResponse(EntitySchema));
