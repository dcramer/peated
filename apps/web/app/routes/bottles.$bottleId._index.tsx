import { makeTRPCClient } from "@peated/server/lib/trpc";
import type { Bottle } from "@peated/server/types";
import config from "@peated/web/config";
import { useOutletContext } from "@remix-run/react";
import { captureException } from "@sentry/remix";
import { type SitemapFunction } from "remix-sitemap";
import BottleOverview from "../components/bottleOverview";
import BottlePriceHistory from "../components/bottlePriceHistory.client";
import { ClientOnly } from "../components/clientOnly";

export const sitemap: SitemapFunction = async ({
  config: sitemapConfig,
  request,
}) => {
  const trpcClient = makeTRPCClient(config.API_SERVER, null, captureException);

  let cursor: number | null = 1;
  const output = [];
  while (cursor) {
    const { results, rel } = await trpcClient.bottleList.query({
      cursor,
    });

    output.push(
      ...results.map((bottle) => ({
        loc: `/bottles/${bottle.id}`,
        lastmod: bottle.createdAt, // not correct
      })),
    );

    cursor = rel?.nextCursor || null;
  }
  return output;
};

export default function BottleDetails() {
  const { bottle } = useOutletContext<{
    bottle: Bottle & {
      people: number;
    };
  }>();

  const stats = [
    {
      name: "Avg Rating",
      value:
        bottle.avgRating !== null
          ? (Math.round(bottle.avgRating * 100) / 100).toFixed(2)
          : "",
    },
    { name: "Tastings", value: bottle.totalTastings.toLocaleString() },
    { name: "People", value: bottle.people.toLocaleString() },
  ];

  return (
    <>
      <div className="my-6 grid grid-cols-3 items-center gap-3 text-center lg:grid-cols-4 lg:text-left">
        {stats.map((stat) => (
          <div key={stat.name}>
            <div className="text-light leading-7">{stat.name}</div>
            <div className="order-first text-3xl font-semibold tracking-tight lg:text-5xl">
              {stat.value || "-"}
            </div>
          </div>
        ))}
        <div className="hidden lg:block">
          <div className="text-light leading-7">Price</div>
          <div className="flex items-center">
            <ClientOnly fallback={<div className="h-[45px] animate-pulse" />}>
              {() => <BottlePriceHistory bottleId={bottle.id} />}
            </ClientOnly>
          </div>
        </div>
      </div>
      <BottleOverview bottle={bottle} />
    </>
  );
}
