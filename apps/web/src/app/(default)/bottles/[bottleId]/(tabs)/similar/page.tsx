import BetaNotice from "@peated/web/components/betaNotice";
import BottleTable from "@peated/web/components/bottleTable";
import { client } from "@peated/web/lib/orpc/client";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const bottle = await client.bottles.details({
    bottle: Number(bottleId),
  });

  return {
    title: `Whisky Similar to ${bottle.fullName}`,
  };
}

export default async function Page({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const bottleList = await client.bottles.similar({
    bottle: Number(bottleId),
  });

  return (
    <div className="mt-6 px-3 lg:px-0">
      <BetaNotice>This is a work in progress.</BetaNotice>

      <BottleTable bottleList={bottleList.results} rel={bottleList.rel} />
    </div>
  );
}
