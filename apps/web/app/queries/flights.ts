import type { Flight, Paginated } from "@peated/core/types";
import type { ApiClient } from "~/lib/api";

export async function fetchFlights(api: ApiClient): Promise<Paginated<Flight>> {
  return api.get("/flights");
}

export async function getFlight(
  api: ApiClient,
  flightId: number | string,
): Promise<Flight> {
  return api.get(`/flights/${flightId}`);
}
