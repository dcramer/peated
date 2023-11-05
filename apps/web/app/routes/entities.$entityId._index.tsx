import type { Entity } from "@peated/shared/types";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useOutletContext, useParams } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import { type LatLngTuple } from "leaflet";
import invariant from "tiny-invariant";
import RobotImage from "~/assets/robot.png";
import { ClientOnly } from "~/components/clientOnly";
import Collapsable from "~/components/collapsable";
import { DistributionChart } from "~/components/distributionChart";
import { Map } from "~/components/map.client";
import Markdown from "~/components/markdown";
import QueryBoundary from "~/components/queryBoundary";
import useApi from "~/hooks/useApi";
import { formatCategoryName } from "~/lib/strings";
import { parseDomain } from "~/lib/urls";
import { fetchEntityCategories } from "~/queries/entities";
import { fetchTastings } from "~/queries/tastings";

export async function loader({
  params: { entityId },
  context,
}: LoaderFunctionArgs) {
  invariant(entityId);

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["entity", entityId, "tastings"], () =>
    fetchTastings(context.api, {
      entity: entityId,
    }),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export const links: LinksFunction = () => [
  {
    rel: "stylesheet",
    href: "https://unpkg.com/leaflet@1.8.0/dist/leaflet.css",
  },
];

export default function EntityDetailsOverview() {
  const { entity } = useOutletContext<{ entity: Entity }>();
  const params = useParams();
  invariant(params.entityId);

  return (
    <>
      <div className="my-6 flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <ClientOnly
            fallback={
              <div
                className="mb-4 animate-pulse rounded bg-slate-800"
                style={{ height: 20 }}
              />
            }
          >
            {() => (
              <>
                <QueryBoundary
                  loading={
                    <div
                      className="mb-4 animate-pulse rounded bg-slate-800"
                      style={{ height: 20 }}
                    />
                  }
                  fallback={() => null}
                >
                  <EntitySpiritDistribution entityId={entity.id} />
                </QueryBoundary>
              </>
            )}
          </ClientOnly>
        </div>
        <EntityMap position={entity.location} />
      </div>

      {entity.description && (
        <div className="my-6">
          <div className="mt-5 flex space-x-4">
            <Collapsable mobileOnly>
              <div className="prose prose-invert -mt-5 max-w-none flex-1">
                <Markdown content={entity.description} />
              </div>
            </Collapsable>

            <img src={RobotImage} className="hidden h-40 w-40 sm:block" />
          </div>
          <div className="prose prose-invert max-w-none flex-1">
            <dl>
              <dt>Website</dt>
              <dd>
                {entity.website ? (
                  <a href={entity.website} className="hover:underline">
                    {parseDomain(entity.website)}
                  </a>
                ) : (
                  <em>n/a</em>
                )}
              </dd>
              <dt>Year Established</dt>
              <dd>{entity.yearEstablished ?? <em>n/a</em>}</dd>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}

const EntitySpiritDistribution = ({ entityId }: { entityId: number }) => {
  const api = useApi();

  const { data } = useQuery(["entities", entityId, "categories"], () =>
    fetchEntityCategories(api, entityId),
  );

  if (!data) return null;

  const { results, totalCount } = data;

  if (!results.length) return null;

  return (
    <DistributionChart
      items={results.map((t) => ({
        name: formatCategoryName(t.category),
        count: t.count,
        category: t.category,
      }))}
      totalCount={totalCount}
      to={(item) =>
        `/bottles?entity=${entityId}&category=${encodeURIComponent(
          item.category,
        )}`
      }
    />
  );
};

const EntityMap = ({ position }: { position: LatLngTuple | null }) => {
  const mapHeight = "200px";
  const mapWidth = mapHeight;

  if (!position) return null;

  return (
    <ClientOnly
      fallback={
        <div
          className="animate-pulse bg-slate-800"
          style={{ height: mapHeight, width: mapWidth }}
        />
      }
    >
      {() => <Map height={mapHeight} width={mapWidth} position={position} />}
    </ClientOnly>
  );
};
