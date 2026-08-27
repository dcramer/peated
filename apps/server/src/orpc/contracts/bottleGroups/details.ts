import { BottleGroupV1Schema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/bottle-groups/{group}",
    summary: "Get Bottle Group",
    description: "Get a Bottle Group and its combined ratings and counts",
    operationId: "getBottleGroup",
  })
  .input(z.object({ group: z.coerce.number().int().positive() }).strict())
  .output(BottleGroupV1Schema);
