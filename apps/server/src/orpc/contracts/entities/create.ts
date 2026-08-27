import { EntityInputSchema, EntitySchema } from "@peated/server/schemas";
import { contract } from "../base";

export default contract
  .route({
    method: "POST",
    path: "/entities",
    operationId: "createEntity",
    summary: "Create an entity",
  })
  .input(EntityInputSchema)
  .output(EntitySchema);
