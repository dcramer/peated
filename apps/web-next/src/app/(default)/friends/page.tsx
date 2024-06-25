import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import type { Metadata } from "next";
import Content from "./content";

export const metadata: Metadata = {
  title: "Friends",
};

export default async function Page() {
  if (!(await isLoggedIn())) {
    redirectToAuth({ pathname: "/friends" });
    return null;
  }

  const trpcClient = await getTrpcClient();
  const friendList = await trpcClient.friendList.ensureData();

  return (
    <>
      <Content friendList={friendList} />
    </>
  );
}
