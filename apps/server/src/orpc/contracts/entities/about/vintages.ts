import { EntityYearCountsSchema } from "@peated/server/schemas";
import { z } from "zod";

import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/about/vintages",
    summary: "List entity vintage counts",
    description:
      "Count active bottles distilled at the entity for each vintage year.",
    operationId: "listEntityVintageCounts",
  })
  .input(z.object({ entity: z.coerce.number() }))
  .output(EntityYearCountsSchema);
