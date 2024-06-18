import { MapIcon } from "@heroicons/react/24/outline";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Entity } from "@peated/server/types";
import RobotImage from "@peated/web/assets/robot.png";
import { ClientOnly } from "@peated/web/components/clientOnly";
import { DistributionChart } from "@peated/web/components/distributionChart";
import { Map } from "@peated/web/components/map.client";
import Markdown from "@peated/web/components/markdown";
import QueryBoundary from "@peated/web/components/queryBoundary";
import { trpc } from "@peated/web/lib/trpc";
import { parseDomain } from "@peated/web/lib/urls";
import type { LinksFunction } from "@remix-run/node";
import { Link, useOutletContext, useParams } from "@remix-run/react";
import { type LatLngTuple } from "leaflet";
import invariant from "tiny-invariant";

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
      </div>

      <div className="my-6 px-3 md:px-0">
        {entity.description && (
          <div className="flex space-x-4">
            <div className="prose prose-invert -mt-5 max-w-none flex-auto">
              <Markdown content={entity.description} />
            </div>

            <img src={RobotImage} className="hidden h-40 w-40 sm:block" />
          </div>
        )}
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
            {!!entity.shortName && (
              <>
                <dt>Abbreviated As</dt>
                <dd>{entity.shortName}</dd>
              </>
            )}
            <dt>Location</dt>
            <dd className="flex flex-col space-y-2">
              <div>
                {entity.address ? (
                  <div className="flex flex-row items-center gap-x-2">
                    {entity.address}
                    <Link
                      to={`http://maps.google.com/?q=${encodeURIComponent(`${entity.name}, ${entity.address}`)}`}
                      target="_blank"
                      className="text-highlight"
                    >
                      <MapIcon className="h-4 w-4" />
                    </Link>
                  </div>
                ) : null}
                <div>
                  {entity.region && entity.country ? (
                    <>
                      <Link to={`/entities?region=${entity.region}`}>
                        {entity.region}
                      </Link>
                      <span>, </span>
                      <Link to={`/entities?country=${entity.country}`}>
                        {entity.country}
                      </Link>
                    </>
                  ) : (
                    (
                      <Link to={`/entities?country=${entity.country}`}>
                        {entity.country}
                      </Link>
                    ) ?? <em>n/a</em>
                  )}
                </div>
              </div>
              <EntityMap position={entity.location} />
            </dd>
          </dl>
        </div>
      </div>
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
  const mapHeight = "400px";
  const mapWidth = "100%";

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
