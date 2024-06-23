import { getTrpcClient } from "@peated/web/lib/trpc.server";

import EntityTable from "@peated/web/components/entityTable";
import Heading from "@peated/web/components/heading";
import Map from "@peated/web/components/map";
import PageHeader from "@peated/web/components/pageHeader";
import { Suspense } from "react";
import { getCountry } from "../utils.server";

export async function generateMetadata({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const country = await getCountry(countrySlug);

  return {
    title: `Whisky from ${country.name}`,
  };
}

export default async function Page({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const trpcClient = await getTrpcClient();
  const [country, topEntityList] = await Promise.all([
    getCountry(countrySlug),
    trpcClient.entityList.query({
      country: countrySlug,
      type: "distiller",
      sort: "-bottles",
      limit: 5,
    }),
  ]);

  const [mapHeight, mapWidth] = ["400px", "100%"];

  const stats = [
    { name: "Distilleries", value: country.totalDistilleries.toLocaleString() },
    { name: "Bottles", value: country.totalBottles.toLocaleString() },
  ];

  return (
    <>
      <PageHeader title={country.name} />

      <div className="my-6 grid grid-cols-3 items-center gap-3 text-center lg:grid-cols-4 lg:text-left">
        {stats.map((stat) => (
          <div key={stat.name}>
            <div className="text-light leading-7">{stat.name}</div>
            <div className="order-first text-3xl font-semibold tracking-tight lg:text-5xl">
              {stat.value || "-"}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col space-y-4">
        <Suspense
          fallback={
            <div
              className="animate-pulse bg-slate-800"
              style={{ height: mapHeight, width: mapWidth }}
            />
          }
        >
          <Map
            height={mapHeight}
            width={mapWidth}
            position={country.location}
          />
        </Suspense>

        <div>
          <Heading as="h2">Popular Distilleries</Heading>
          {topEntityList.results.length ? (
            <EntityTable entityList={topEntityList.results} />
          ) : (
            <p className="text-light">
              {"It looks like we don't know of any distilleries in the area."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
