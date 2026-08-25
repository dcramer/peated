import { db } from "@peated/server/db";
import { bottleBarcodes } from "@peated/server/db/schema";
import { normalizeGtin } from "@peated/server/lib/gtin";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { GtinSchema } from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "DELETE",
    path: "/bottle-barcodes/{barcode}",
    summary: "Delete a Bottle barcode",
    description:
      "Remove a product barcode from a Bottle. Requires moderator privileges",
    operationId: "deleteBottleBarcode",
  })
  .input(z.object({ barcode: GtinSchema }).strict())
  .output(z.object({}))
  .handler(async function ({ input, errors }) {
    const { gtin14 } = normalizeGtin(input.barcode);
    const [deleted] = await db
      .delete(bottleBarcodes)
      .where(eq(bottleBarcodes.gtin14, gtin14))
      .returning({ id: bottleBarcodes.id });
    if (!deleted) {
      throw errors.NOT_FOUND({ message: "Bottle barcode not found." });
    }

    return {};
  });
