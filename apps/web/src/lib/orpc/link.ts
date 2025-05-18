import { RPCLink } from "@orpc/client/fetch";

export function getLink({
  apiServer,
  accessToken,
  batch,
  userAgent,
}: {
  apiServer: string;
  accessToken?: string | null;
  batch?: boolean;
  userAgent: string;
}) {
  return new RPCLink({
    async headers() {
      return {
        authorization: accessToken ? `Bearer ${accessToken}` : "",
        "user-agent": userAgent,
      };
    },
    url: `${apiServer}/rpc`,
  });
}
