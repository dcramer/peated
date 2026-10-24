import { EntityAboutSchema } from "@peated/server/schemas";
import { z } from "zod";

import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/about",
    summary: "Get entity About page",
    description:
      "Get the sourced history, site facts, prose, and sources for a brand or distillery. Facts without a source and every source quote are left out. Returns `null` when the entity has no published About page.",
    operationId: "getEntityAbout",
  })
  .input(z.object({ entity: z.coerce.number().int().positive() }))
  .output(EntityAboutSchema.nullable());
