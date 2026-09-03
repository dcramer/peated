import { EntitySchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";

import { contract } from "../base";

const SmwsDistillerSchema = EntitySchema.extend({
  smwsCodes: z
    .array(z.string())
    .readonly()
    .describe("SMWS codes that resolve to this distillery"),
});

export default contract
  .route({
    tags: ["smws"],
    method: "GET",
    path: "/smws/distillers",
    summary: "List SMWS distillers",
    description:
      "Retrieve distillers that are part of the Scotch Malt Whisky Society (SMWS) system",
    spec: (spec) => ({ ...spec, operationId: "listSmwsDistillers" }),
  })
  .output(listResponse(SmwsDistillerSchema));
