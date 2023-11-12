import type { Entity } from "@peated/server/types";
import type { LinksFunction } from "@remix-run/node";
import { useOutletContext, useParams } from "@remix-run/react";
import { type LatLngTuple } from "leaflet";
import invariant from "tiny-invariant";
import RobotImage from "~/assets/robot.png";
import { ClientOnly } from "~/components/clientOnly";
import { DistributionChart } from "~/components/distributionChart";
import { Map } from "~/components/map.client";
import Markdown from "~/components/markdown";
import QueryBoundary from "~/components/queryBoundary";
import { formatCategoryName } from "~/lib/strings";
import { trpc } from "~/lib/trpc";
import { parseDomain } from "~/lib/urls";

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
      <div className="my-6 flex flex-col gap-4 px-3 sm:flex-row md:px-0">
        <div className="flex-auto">
          <ClientOnly
            fallback={
              <div
                className="animate-pulse rounded bg-slate-800"
                style={{ height: 20 }}
              />
            }
          >
            {() => (
              <>
                <QueryBoundary
                  loading={
                    <div
                      className="animate-pulse rounded bg-slate-800"
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
        <div className="my-6 px-3 md:px-0">
          <div className="flex space-x-4">
            <div className="prose prose-invert -mt-5 max-w-none flex-auto">
              <Markdown content={entity.description} />
            </div>

            <img src={RobotImage} className="hidden h-40 w-40 sm:block" />
          </div>
          <div className="prose prose-invert max-w-none flex-auto">
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
  const { data } = trpc.entityCategoryList.useQuery({
    entity: entityId,
  });

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
