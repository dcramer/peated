import BetaNotice from "@peated/web/components/betaNotice";
import TimeSince from "@peated/web/components/timeSince";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.ensureData(Number(bottleId));

  return [
    {
      title: `Prices for ${bottle.fullName}`,
    },
  ];
}

export default async function BottlePrices({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const priceList = await trpcClient.bottlePriceList.ensureData({
    bottle: Number(bottleId),
  });

  return (
    <div className="mt-6 px-3 lg:px-0">
      <BetaNotice>This is a work in progress.</BetaNotice>

      {priceList.results.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {priceList.results.map((price) => {
            return (
              <li key={price.id}>
                <a href={price.url} className="flex hover:underline">
                  <span className="flex-auto">{price.site?.name}</span>
                  <span>${(price.price / 100).toFixed(2)}</span>
                </a>
                <span className="text-light text-xs">
                  {price.volume}mL &mdash; <TimeSince date={price.updatedAt} />
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-center text-sm">No sellers found.</p>
      )}
    </div>
  );
}
