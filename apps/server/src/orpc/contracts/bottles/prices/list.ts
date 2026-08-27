import { ExternalSiteSchema, StorePriceSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/bottles/{bottle}/prices",
    summary: "List bottle prices",
    description: "List current and past store prices for a Bottle",
    operationId: "listBottlePrices",
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      onlyValid: z.coerce.boolean().optional(),
    }),
  )
  .output(
    z.object({
      results: z.array(StorePriceSchema.extend({ site: ExternalSiteSchema })),
    }),
  );
