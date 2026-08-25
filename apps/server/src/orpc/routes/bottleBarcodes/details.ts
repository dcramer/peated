import { db } from "@peated/server/db";
import { bottleBarcodes, bottles } from "@peated/server/db/schema";
import { normalizeGtin } from "@peated/server/lib/gtin";
import { procedure } from "@peated/server/orpc";
import { BottleBarcodeLookupSchema, GtinSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { serializeBottleBarcode } from "@peated/server/serializers/bottleBarcode";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-barcodes/{barcode}",
    summary: "Look up a Bottle by barcode",
    description: "Find the Bottle assigned to an approved product barcode",
    operationId: "getBottleBarcode",
  })
  .input(z.object({ barcode: GtinSchema }).strict())
  .output(BottleBarcodeLookupSchema)
  .handler(async function ({ input, context, errors }) {
    const { gtin14 } = normalizeGtin(input.barcode);
    const [result] = await db
      .select({ barcode: bottleBarcodes, bottle: bottles })
      .from(bottleBarcodes)
      .innerJoin(bottles, eq(bottles.id, bottleBarcodes.bottleId))
      .where(eq(bottleBarcodes.gtin14, gtin14))
      .limit(1);
    if (!result) {
      throw errors.NOT_FOUND({ message: "Bottle barcode not found." });
    }

    return {
      barcode: serializeBottleBarcode(result.barcode),
      bottle: await serialize(BottleSerializer, result.bottle, context.user),
    };
  });
