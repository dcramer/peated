import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import Content from "./content";

export default async function Page() {
  if (!(await isLoggedIn())) {
    return redirectToAuth({ pathname: "/friends " });
  }
  const trpcClient = await getTrpcClient();
  const friendList = await trpcClient.friendList.query();

  return <Content friendList={friendList} />;
}
