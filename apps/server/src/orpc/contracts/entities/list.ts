import { EntityKindEnum } from "@peated/server/schemas/common";
import { z } from "zod";
import { contract } from "../base";
import {
  EntityKindListInputSchema,
  EntityKindListOutputSchema,
} from "../entityKinds/list";

export const EntityListInputSchema = EntityKindListInputSchema.unwrap()
  .extend({
    kinds: z
      .array(EntityKindEnum)
      .min(1)
      .max(4)
      .optional()
      .describe("Only return Entities with one of these kinds"),
  })
  .default({
    query: "",
    filter: "all",
    sort: "rank",
    cursor: 1,
    limit: 100,
  });

export default contract
  .route({
    method: "GET",
    path: "/entities",
    summary: "List entities",
    description: "Find Entities of any kind for selection fields",
    operationId: "listEntities",
  })
  .input(EntityListInputSchema)
  .output(EntityKindListOutputSchema);
