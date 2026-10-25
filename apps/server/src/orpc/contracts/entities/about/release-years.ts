import { EntityYearCountsSchema } from "@peated/server/schemas";
import { z } from "zod";

import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/about/release-years",
    summary: "List entity release-year counts",
    description:
      "Count active bottles for each release year: every bottle distilled at a distillery, or the bottles sold under any other entity as brand.",
    operationId: "listEntityReleaseYearCounts",
  })
  .input(z.object({ entity: z.coerce.number().int().positive() }))
  .output(EntityYearCountsSchema);
