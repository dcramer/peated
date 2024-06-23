import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { cache } from "react";

export const getCountry = cache(async (slug: string) => {
  const trpcClient = await getTrpcClient();
  return trpcClient.countryBySlug.query(slug);
});
