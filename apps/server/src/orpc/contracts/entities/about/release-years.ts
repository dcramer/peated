import { EntityYearCountsSchema } from "@peated/server/schemas";
import { z } from "zod";

import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/about/release-years",
    summary: "List entity release-year counts",
    description:
      "Count active bottles sold under the entity as brand for each release year.",
    operationId: "listEntityReleaseYearCounts",
  })
  .input(z.object({ entity: z.coerce.number() }))
  .output(EntityYearCountsSchema);
