import type { BottlePriceChangeSchema } from "@peated/core/schemas";
import type { Paginated } from "@peated/core/types";
import type { z } from "zod";
import type { ApiClient } from "~/lib/api";

export async function fetchPriceChanges(
  api: ApiClient,
): Promise<Paginated<z.infer<typeof BottlePriceChangeSchema>>> {
  return api.get(`/priceChanges`);
}
