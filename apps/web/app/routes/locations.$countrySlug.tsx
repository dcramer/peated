import Layout from "@peated/web/components/layout";
import type { MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { ClientOnly } from "../components/clientOnly";
import EntityTable from "../components/entityTable";
import { Map } from "../components/map.client";
import PageHeader from "../components/pageHeader";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, params, context: { queryUtils } }) => {
    invariant(params.countrySlug);

    const [country, topEntityList] = await Promise.all([
      queryUtils.countryBySlug.ensureData(params.countrySlug),
      queryUtils.entityList.ensureData({
        country: params.countrySlug,
        type: "distiller",
        limit: 5,
      }),
    ]);

    return { country, topEntityList };
  },
);

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  return [
    {
      title: data.country.name,
    },
  ];
};

export default function CountryDetails() {
  const { country, topEntityList } = useLoaderData<typeof loader>();

  const [mapHeight, mapWidth] = ["400px", "100%"];

  return (
    <Layout>
      <PageHeader title={country.name} />
      <div className="flex flex-col space-y-4">
        <ClientOnly
          fallback={
            <div
              className="animate-pulse bg-slate-800"
              style={{ height: mapHeight, width: mapWidth }}
            />
          }
        >
          {() => (
            <Map
              height={mapHeight}
              width={mapWidth}
              position={country.location}
            />
          )}
        </ClientOnly>

        <div>
          <h2>Popular Distilleries</h2>
          {topEntityList.length ? (
            <EntityTable entityList={topEntityList.results} />
          ) : (
            <p className="text-light">
              It looks like we don't know of any distilleries in the area.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
