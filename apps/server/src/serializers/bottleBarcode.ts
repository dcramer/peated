import type { BottleBarcode } from "@peated/server/db/schema";
import type { BottleBarcodeApi } from "@peated/server/schemas";

export function serializeBottleBarcode(
  barcode: BottleBarcode,
): BottleBarcodeApi {
  return {
    id: barcode.id,
    bottle: barcode.bottleId,
    value: barcode.value,
    volume: barcode.volume,
    createdAt: barcode.createdAt.toISOString(),
  };
}
