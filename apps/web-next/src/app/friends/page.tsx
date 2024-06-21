"use client";

import useAuthRequired from "@peated/web-next/hooks/useAuthRequired";
import { trpcClient } from "@peated/web-next/lib/trpc";
import Content from "./content";

export default function Page() {
  useAuthRequired();

  const trpcUtils = trpcClient.useUtils();
  trpcUtils.friendList.prefetch();

  return <Content />;
}
