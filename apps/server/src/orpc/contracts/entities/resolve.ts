import { EntityKindEnum } from "@peated/server/schemas/common";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/entities/{entity}/resolve",
    summary: "Resolve an entity route",
    description: "Resolve an Entity ID and primary kind through tombstones",
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
