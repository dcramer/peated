import { EntityKindEnum } from "@peated/server/schemas/common";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/resolve",
    summary: "Resolve an entity ID",
    description:
      "Get the current entity ID, kind, and name. Follow merged IDs to the remaining entity; return not found for a deleted entity with no replacement.",
    operationId: "resolveEntity",
  })
  .input(z.object({ entity: z.coerce.number().int().positive() }))
  .output(
    z.object({
      id: z.number().readonly(),
      kind: EntityKindEnum,
      name: z.string(),
    }),
  );
