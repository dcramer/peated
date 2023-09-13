import type { StorePriceChangeSchema } from "@peated/shared/schemas";
import type { Paginated } from "@peated/shared/types";
import type { z } from "zod";
import type { ApiClient } from "~/lib/api";

export async function fetchPriceChanges(
  api: ApiClient,
): Promise<Paginated<z.infer<typeof StorePriceChangeSchema>>> {
  return api.get(`/priceChanges`);
}
