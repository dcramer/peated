import { EntityEventSchema } from "@peated/server/schemas";
import { z } from "zod";

import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/events",
    summary: "List entity history",
    description: "List the dated items in an entity's history.",
    operationId: "listEntityEvents",
  })
  .input(z.object({ entity: z.coerce.number() }))
  .output(z.object({ results: z.array(EntityEventSchema) }));
