import BetaNotice from "@peated/web/components/betaNotice";
import BottleTable from "@peated/web/components/bottleTable";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.fetch(Number(bottleId));

  return {
    title: `Whisky Similar to ${bottle.fullName}`,
  };
}

export default async function BottlePrices({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const bottleList = await trpcClient.similarBottleList.fetch({
    bottle: Number(bottleId),
  });

  return (
    <div className="mt-6 px-3 lg:px-0">
      <BetaNotice>This is a work in progress.</BetaNotice>

      <BottleTable bottleList={bottleList.results} rel={bottleList.rel} />
    </div>
  );
}
