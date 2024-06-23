import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { cache } from "react";

export const getUser = cache(async (username: string | "me" | number) => {
  const trpcClient = await getTrpcClient();
  return trpcClient.userById.query(username);
});
