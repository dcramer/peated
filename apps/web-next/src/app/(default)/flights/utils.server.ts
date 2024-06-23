import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { cache } from "react";

export const getFlight = cache(async (id: string) => {
  const trpcClient = await getTrpcClient();
  return trpcClient.flightById.query(id);
});
