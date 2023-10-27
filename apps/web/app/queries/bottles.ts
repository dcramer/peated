import type { StorePriceSchema } from "@peated/shared/schemas";
import type { Bottle, Paginated, Tag } from "@peated/shared/types";
import type { z } from "zod";
import type { ApiClient } from "~/lib/api";

type BottleQueryParams = {
  category?: string;
  age?: string | number;
  brand?: string | number;
  distiller?: string | number;
  bottler?: string | number;
  entity?: string | number;
  tag?: string;
  flight?: string;
  page?: string | number;
  limit?: string | number;
  sort?: string;
};

export async function fetchBottles(
  api: ApiClient,
  params: BottleQueryParams = {},
): Promise<Paginated<Bottle>> {
  return api.get(`/bottles`, {
    query: params,
  });
}

export async function getBottle(
  api: ApiClient,
  bottleId: number | string,
): Promise<
  Bottle & {
    avgRating: number;
    people: number;
  }
> {
  return api.get(`/bottles/${bottleId}`);
}

export async function fetchBottleTags(
  api: ApiClient,
  bottleId: number | string,
): Promise<Paginated<Tag> & { totalCount: number }> {
  return api.get(`/bottles/${bottleId}/tags`);
}

export async function fetchBottlePrices(
  api: ApiClient,
  bottleId: number | string,
): Promise<Paginated<z.infer<typeof StorePriceSchema>>> {
  return api.get(`/bottles/${bottleId}/prices`);
}

export async function fetchBottlePriceHistory(
  api: ApiClient,
  bottleId: number | string,
): Promise<{
  results: {
    date: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
  }[];
}> {
  return api.get(`/bottles/${bottleId}/priceHistory`);
}
