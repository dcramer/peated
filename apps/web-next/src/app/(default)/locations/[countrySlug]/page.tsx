import PageHeader from "@peated/web/components/pageHeader";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

import EntityTable from "@peated/web/components/entityTable";
import Heading from "@peated/web/components/heading";
import { Map } from "@peated/web/components/map.client";
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

  return (
    <>
      <PageHeader title={country.name} />
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
