import BetaNotice from "@peated/web/components/betaNotice";
import TimeSince from "@peated/web/components/timeSince";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import invariant from "tiny-invariant";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { bottleId }, context: { trpc } }) => {
    invariant(bottleId);

    const priceList = await trpc.bottlePriceList.query({
      bottle: Number(bottleId),
    });

    return json({ priceList });
  },
);

export default function BottlePrices() {
  const { priceList } = useLoaderData<typeof loader>();

  if (!priceList) return null;

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
