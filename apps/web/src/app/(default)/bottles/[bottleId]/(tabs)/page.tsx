import BottleOverview from "@peated/web/components/bottleOverview";
import Price from "@peated/web/components/price";
import { summarize } from "@peated/web/lib/markdown";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

export const fetchCache = "default-no-store";

export const dynamic = "force-dynamic";

// export const sitemap: SitemapFunction = async ({
//   config: sitemapConfig,
//   request,
// }) => {
//   const trpcClient = makeTRPCClient(config.API_SERVER, null, captureException);

//   let cursor: number | null = 1;
//   const output = [];
//   while (cursor) {
//     const { results, rel } = await trpcClient.bottleList.query({
//       cursor,
//     });

//     output.push(
//       ...results.map((bottle) => ({
//         loc: `/bottles/${bottle.id}`,
//         lastmod: bottle.createdAt, // not correct
//       })),
//     );

//     cursor = rel?.nextCursor || null;
//   }
//   return output;
// };

export async function generateMetadata({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.ensureData(Number(bottleId));

  const description = summarize(bottle.description || "", 200);

  return {
    title: bottle.fullName,
    description,
    openGraph: {
      title: bottle.fullName,
      description: description,
    },
    twitter: {
      card: "product",
    },
  };
}

export default async function BottleDetails({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.ensureData(Number(bottleId));

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
    {
      name: "Price",
      value: bottle.lastPrice ? (
        <Price
          value={bottle.lastPrice.price}
          currency={bottle.lastPrice.currency}
          noCents
        />
      ) : null,
    },
  ];

  return (
    <>
      <div className="my-6 grid grid-cols-2 items-center gap-3 text-center lg:grid-cols-4 lg:text-left">
        {stats.map((stat) => (
          <div key={stat.name}>
            <div className="text-light leading-7">{stat.name}</div>
            <div className="order-first text-3xl font-semibold tracking-tight lg:text-5xl">
              {stat.value || "-"}
            </div>
          </div>
        ))}
      </div>
      <BottleOverview bottle={bottle} />
    </>
  );
}
