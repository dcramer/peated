import BetaNotice from "@peated/web/components/betaNotice";
import Price from "@peated/web/components/price";
import TimeSince from "@peated/web/components/timeSince";
import classNames from "@peated/web/lib/classNames";
import { getServerClient } from "@peated/web/lib/orpc/client.server";

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const client = await getServerClient();

  const bottle = await client.bottles.details({
    bottle: Number(bottleId),
  });

  return {
    title: `Prices for ${bottle.fullName}`,
  };
}

export default async function BottlePrices({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const client = await getServerClient();

  const priceList = await client.bottles.prices.list({
    bottle: Number(bottleId),
  });

  return (
    <div className="mt-6 px-3 lg:px-0">
      <BetaNotice>This is a work in progress.</BetaNotice>

      {priceList.results.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {priceList.results.map((price) => {
            return (
              <li
                key={price.id}
                className={classNames({
                  "opacity-70": !price.isValid,
                })}
              >
                <a
                  href={price.isValid ? price.url : undefined}
                  className={classNames("flex", {
                    "hover:underline": price.isValid,
                  })}
                >
                  <span className="flex-auto">
                    <strong>{price.site?.name}</strong> &mdash; {price.name}
                  </span>
                  <span>
                    <Price value={price.price} currency={price.currency} />
                  </span>
                </a>
                <span className="text-muted text-xs">
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
