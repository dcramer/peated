import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { cache } from "react";

export const getBottle = cache(async (id: number) => {
  const trpcClient = await getTrpcClient();
  return trpcClient.bottleById.query(id);
});
