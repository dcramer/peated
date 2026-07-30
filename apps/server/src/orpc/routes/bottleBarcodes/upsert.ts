import { db } from "@peated/server/db";
import { bottleBarcodes, bottles } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { normalizeGtin } from "@peated/server/lib/gtin";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleBarcodeSchema, GtinSchema } from "@peated/server/schemas";
import { serializeBottleBarcode } from "@peated/server/serializers/bottleBarcode";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/bottle-barcodes",
    summary: "Add bottle barcode",
    description:
      "Assign a canonical GTIN barcode to an exact Bottle. Requires moderator privileges",
    operationId: "upsertBottleBarcode",
  })
  .input(
    z
      .object({
        bottle: z.coerce.number(),
        barcode: GtinSchema,
      })
      .strict(),
  )
  .output(BottleBarcodeSchema)
  .handler(async function ({ input, context, errors }) {
    const normalized = normalizeGtin(input.barcode);
    const barcode = await db.transaction(async (tx) => {
      const [bottle] = await tx
        .select({ id: bottles.id })
        .from(bottles)
        .where(eq(bottles.id, input.bottle))
        .limit(1);
      if (!bottle) {
        throw errors.NOT_FOUND({ message: "Bottle not found." });
      }

      const actor = await getUserActorForDatabase(tx, context.user);
      const [created] = await tx
        .insert(bottleBarcodes)
        .values({
          bottleId: bottle.id,
          value: normalized.value,
          gtin14: normalized.gtin14,
          createdByActorId: actor.id,
        })
        .onConflictDoNothing({ target: bottleBarcodes.gtin14 })
        .returning();
      if (created) {
        return created;
      }

      const [existing] = await tx
        .select()
        .from(bottleBarcodes)
        .where(eq(bottleBarcodes.gtin14, normalized.gtin14))
        .limit(1);
      if (!existing) {
        throw errors.CONFLICT({
          message: "Bottle barcode changed while it was being assigned.",
        });
      }
      if (existing.bottleId !== bottle.id) {
        throw errors.CONFLICT({
          message: "Barcode is already assigned to another Bottle.",
        });
      }
      return existing;
    });

    return serializeBottleBarcode(barcode);
  });
