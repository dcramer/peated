import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import ReleaseTable from "./releaseTable";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.fetch(Number(bottleId));

  return {
    title: `Releases of ${bottle.fullName}`,
    description: `Known releases of ${bottle.fullName}, including specific vintages and special releases.`,
  };
}

export default async function Page({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const releaseList = await trpcClient.bottleReleaseList.fetch({
    bottle: Number(bottleId),
  });

  return (
    <div className="mt-6 px-3 lg:px-0">
      <ReleaseTable bottleId={Number(bottleId)} releaseList={releaseList} />
    </div>
  );
}
