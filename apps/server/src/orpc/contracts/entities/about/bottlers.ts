import { EntityRelatedCountsSchema } from "@peated/server/schemas";
import { z } from "zod";

import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/about/bottlers",
    summary: "List entity bottler counts",
    description:
      "Count active bottles distilled at the entity for each bottler. `withoutEntity` counts bottles with no bottler, such as official releases.",
    operationId: "listEntityBottlerCounts",
  })
  .input(z.object({ entity: z.coerce.number().int().positive() }))
  .output(EntityRelatedCountsSchema);
