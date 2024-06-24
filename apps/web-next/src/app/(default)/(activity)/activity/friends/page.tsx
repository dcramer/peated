import ActivityFeed from "@peated/web/components/activityFeed";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { Suspense } from "react";

export default async function Page() {
  const filter = "friends";
  const trpcClient = await getTrpcClient();
  const tastingList = await trpcClient.tastingList.ensureData({
    filter,
    limit: 10,
  });

  return (
    <Suspense>
      <ActivityFeed tastingList={tastingList} filter={filter} />
    </Suspense>
  );
}
