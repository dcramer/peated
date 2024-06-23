import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { cache } from "react";

export const getEntity = cache(async (id: number) => {
  const trpcClient = await getTrpcClient();
  return trpcClient.entityById.query(id);
});
