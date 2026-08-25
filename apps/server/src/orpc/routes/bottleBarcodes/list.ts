import { db } from "@peated/server/db";
import { bottleBarcodes, bottles } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { BottleBarcodeSchema } from "@peated/server/schemas";
import { serializeBottleBarcode } from "@peated/server/serializers/bottleBarcode";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-barcodes",
    summary: "List bottle barcodes",
    description: "List approved product barcodes assigned to a Bottle",
    operationId: "listBottleBarcodes",
  })
  .input(z.object({ bottle: z.coerce.number() }).strict())
  .output(z.object({ results: z.array(BottleBarcodeSchema) }))
  .handler(async function ({ input, errors }) {
    const [bottle] = await db
      .select({ id: bottles.id })
      .from(bottles)
      .where(eq(bottles.id, input.bottle))
      .limit(1);
    if (!bottle) {
      throw errors.NOT_FOUND({ message: "Bottle not found." });
    }

    const results = await db
      .select()
      .from(bottleBarcodes)
      .where(eq(bottleBarcodes.bottleId, bottle.id))
      .orderBy(asc(bottleBarcodes.value), asc(bottleBarcodes.id));

    return { results: results.map(serializeBottleBarcode) };
  });
