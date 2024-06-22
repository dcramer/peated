import { getTrpcClient } from "@peated/web/lib/trpc";
import Content from "./content";

export default async function Page() {
  const trpcClient = await getTrpcClient();
  const friendList = await trpcClient.friendList.query();

  return <Content friendList={friendList} />;
}
