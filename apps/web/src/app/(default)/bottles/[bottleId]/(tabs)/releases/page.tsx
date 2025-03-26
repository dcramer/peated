import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
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

  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      bottle: Number(bottleId),
      limit: 100,
    },
  });

  const releaseList = await trpcClient.bottleReleaseList.fetch(queryParams);

  return (
    <div className="mt-6 px-3 lg:px-0">
      <ReleaseTable bottleId={Number(bottleId)} releaseList={releaseList} />
    </div>
  );
}
