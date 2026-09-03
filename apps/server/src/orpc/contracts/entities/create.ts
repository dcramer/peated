import { EntityInputSchema, EntitySchema } from "@peated/server/schemas";
import { contract } from "../base";

export default contract
  .route({
    method: "POST",
    path: "/entities",
    operationId: "createEntity",
    summary: "Create an entity",
    description:
      "Create a brand, distillery, bottler, or company. Return the existing entity when its normalized name and kind match. Requires a verified account and acceptance of the Terms of Service.",
  })
  .input(EntityInputSchema)
  .output(EntitySchema);
