import { EntityRelatedCountsSchema } from "@peated/server/schemas";
import { z } from "zod";

import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/about/distillers",
    summary: "List entity distillery counts",
    description:
      "Count active bottles sold under the entity as brand for each distillery that made them.",
    operationId: "listEntityDistilleryCounts",
  })
  .input(z.object({ entity: z.coerce.number() }))
  .output(EntityRelatedCountsSchema);
