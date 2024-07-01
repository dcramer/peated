"use client";

import { notEmpty } from "@peated/server/src/lib/filter";
import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import Map from "@peated/web/components/map";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { trpc } from "@peated/web/lib/trpc";
import { useSearchParams } from "next/navigation";

export default function Page({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const searchParams = useSearchParams();
  const [[country, topEntityList]] = trpc.useSuspenseQueries((t) => [
    t.countryBySlug(countrySlug),
    t.entityList({
      ...Object.fromEntries(searchParams.entries()),
      country: countrySlug,
      type: "distiller",
      sort: "-bottles",
      limit: 20,
    }),
  ]);

  const [mapHeight, mapWidth] = ["200px", "100%"];

  return (
    <>
      <Map
        height={mapHeight}
        width={mapWidth}
        initialZoom={6}
        position={country.location}
        markers={topEntityList.results
          .map((e) => {
            if (!e.location) return null;
            return {
              position: e.location,
              name: e.name,
              address: e.address,
            };
          })
          .filter(notEmpty)}
      />

      {topEntityList.results.length ? (
        <EntityTable entityList={topEntityList.results} type="distiller" />
      ) : (
        <EmptyActivity>
          {"It looks like we don't know of any distilleries in the area."}
        </EmptyActivity>
      )}

      <PaginationButtons rel={topEntityList.rel} />
    </>
  );
}
