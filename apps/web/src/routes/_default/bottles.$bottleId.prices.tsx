import BetaNotice from "@peated/web/components/betaNotice";
import Price from "@peated/web/components/price";
import TimeSince from "@peated/web/components/timeSince";
import classNames from "@peated/web/lib/classNames";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/bottles/$bottleId/prices")({
  component: Page,
});

function Page() {
  const { bottleId } = Route.useParams();
  const orpc = useORPC();
  const { data: priceList } = useSuspenseQuery(
    orpc.bottles.prices.list.queryOptions({
      input: {
        bottle: Number(bottleId),
      },
    })
  );

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
