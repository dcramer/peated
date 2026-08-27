import { EntitySchema, listResponse } from "@peated/server/schemas";

import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/smws/distillers",
    summary: "List SMWS distillers",
    description:
      "Retrieve distillers that are part of the Scotch Malt Whisky Society (SMWS) system",
    spec: (spec) => ({ ...spec, operationId: "listSmwsDistillers" }),
  })
  .output(listResponse(EntitySchema));
