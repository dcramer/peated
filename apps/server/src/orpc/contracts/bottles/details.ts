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
      "Get bottle details, including barcodes, prices, and tasting counts",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottle",
    }),
  })
  .input(z.object({ bottle: z.coerce.number() }))
  // TODO(response-envelope): Return { data: ... } when all detail routes use the
  // same wrapper.
  .output(detailsResponse(OutputSchema));
