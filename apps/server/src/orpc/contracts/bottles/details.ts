import {
  BottleBarcodeSchema,
  BottleSchema,
  StorePriceSchema,
  detailsResponse,
} from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const OutputSchema = z.intersection(
  BottleSchema,
  z.object({
    barcodes: z
      .array(BottleBarcodeSchema.pick({ value: true, volume: true }))
      .readonly()
      .describe("Product barcodes for this Bottle"),
    people: z.number(),
    lastPrice: StorePriceSchema.nullable(),
  }),
);

export default contract
  .route({
    method: "GET",
    path: "/bottles/{bottle}",
    summary: "Get bottle details",
    description:
      "Retrieve Bottle details, including product barcodes, pricing, and tasting statistics",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottle",
    }),
  })
  .input(z.object({ bottle: z.coerce.number() }))
  // TODO(response-envelope): switch to wrapping the details payload as
  // { data: ... } by updating detailsResponse() when we migrate envelopes.
  .output(detailsResponse(OutputSchema));
