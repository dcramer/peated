import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { cache } from "react";

export const getTasting = cache(async (id: number) => {
  const trpcClient = await getTrpcClient();
  return trpcClient.tastingById.query(id);
});
