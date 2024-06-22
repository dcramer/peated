import { makeTRPCClient } from "@peated/server/lib/trpc";
import config from "@peated/web/config";
import { getSession } from "@peated/web/lib/session.server";

export async function getTrpcClient() {
  const session = await getSession();

  return makeTRPCClient(config.API_SERVER, session.accessToken);
}
