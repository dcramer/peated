import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import BetaNotice from "~/components/betaNotice";
import TimeSince from "~/components/timeSince";
import { fetchBottlePrices } from "~/queries/bottles";

export async function loader({
  params: { bottleId },
  context,
}: LoaderFunctionArgs) {
  invariant(bottleId);
  const data = await fetchBottlePrices(context.api, bottleId);

  return json({ data });
}

export default function BottlePrices() {
  const { data } = useLoaderData<typeof loader>();

  if (!data) return null;

  return (
    <div className="mt-6">
      <BetaNotice>This is a work in progress.</BetaNotice>

      {data.results.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {data.results.map((price) => {
            return (
              <li key={price.id}>
                <a href={price.url} className="flex hover:underline">
                  <span className="flex-1">{price.store?.name}</span>
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
