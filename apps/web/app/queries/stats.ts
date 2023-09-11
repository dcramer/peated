import type { ApiClient } from "~/lib/api";

export async function fetchStats(api: ApiClient): Promise<{
  totalTastings: number;
  totalBottles: number;
  totalEntities: number;
}> {
  return api.get("/stats");
}
