import { EntitySchema, listResponse } from "@peated/server/schemas";
import { contract } from "../base";
import { EntityKindListInputSchema } from "../entityKinds/list";

export default contract
  .route({
    method: "GET",
    path: "/entities",
    summary: "List entities",
    description: "Find Entities of any kind for selection fields",
    operationId: "listEntities",
  })
  .input(EntityKindListInputSchema)
  .output(listResponse(EntitySchema));
