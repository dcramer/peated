import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { LinksFunction, LoaderArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import type { LatLngTuple } from "leaflet";
import invariant from "tiny-invariant";

import { ShareIcon } from "@heroicons/react/24/outline";
import type { Entity, Paginated } from "@peated/shared/types";
import RobotImage from "~/assets/robot.png";
import EntityIcon from "~/components/assets/Entity";
import BetaNotice from "~/components/betaNotice";
import Button from "~/components/button";
import Chip from "~/components/chip";
import { ClientOnly } from "~/components/clientOnly";
import Collapsable from "~/components/collapsable";
import { DistributionChart } from "~/components/distributionChart";
import Layout from "~/components/layout";
import { Map } from "~/components/map.client";
import Markdown from "~/components/markdown";
import QueryBoundary from "~/components/queryBoundary";
import Tabs from "~/components/tabs";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import { summarize } from "~/lib/markdown";
import { formatCategoryName } from "~/lib/strings";
import { getEntityUrl } from "~/lib/urls";
import { getEntity } from "~/queries/entities";

export async function loader({ params, context }: LoaderArgs) {
  invariant(params.entityId);

  const entity: Entity = await getEntity(context.api, params.entityId);

  return json({ entity });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  const description = summarize(data.entity.description || "", 200);

  return [
    {
      title: data.entity.name,
    },
    {
      name: "description",
      content: description,
    },
    {
      property: "og:title",
      content: data.entity.name,
    },
    {
      property: "og:description",
      content: description,
    },
    {
      property: "twitter:card",
      content: "product",
    },
  ];
};

export const links: LinksFunction = () => [
  {
    rel: "stylesheet",
    href: "https://unpkg.com/leaflet@1.8.0/dist/leaflet.css",
  },
];

export default function EntityDetails() {
  const { entity } = useLoaderData<typeof loader>();
  const params = useParams();
  invariant(params.entityId);

  const { user } = useAuth();

  const baseUrl = getEntityUrl(entity);

  return (
    <Layout>
      <div className="my-4 flex min-w-full flex-wrap gap-x-3 gap-y-4 p-3 sm:flex-nowrap sm:py-0">
        <EntityIcon className="hidden h-14 w-auto sm:inline-block" />

        <div className="w-full flex-1 flex-col items-center space-y-1 sm:w-auto sm:items-start">
          <h1 className="mb-2 truncate text-center text-3xl font-semibold leading-7 sm:text-left">
            {entity.name}
          </h1>
          <div className="truncate text-center text-slate-500 sm:text-left">
            {!!entity.country && (
              <>
                Located in{" "}
                <Link
                  to={`/entities?country=${encodeURIComponent(entity.country)}`}
                  className="hover:underline"
                >
                  {entity.country}
                </Link>
              </>
            )}
            {!!entity.region && (
              <span>
                {" "}
                &middot;{" "}
                <Link
                  to={`/entities?region=${encodeURIComponent(entity.region)}`}
                  className="hover:underline"
                >
                  {entity.region}
                </Link>
              </span>
            )}
          </div>
        </div>
        <div className="sm:justify-left mb-4 flex w-full justify-center space-x-2 sm:w-auto">
          {entity.type.sort().map((t) => (
            <Chip
              key={t}
              size="small"
              color="highlight"
              as={Link}
              to={`/entities?type=${encodeURIComponent(t)}`}
            >
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <div className="my-8 flex justify-center gap-4 sm:justify-start">
            <Button
              to={`/addBottle?${
                entity.type.indexOf("brand") !== -1 ? `brand=${entity.id}&` : ""
              }${
                entity.type.indexOf("distiller") !== -1
                  ? `distiller=${entity.id}&`
                  : ""
              }${
                entity.type.indexOf("bottler") !== -1
                  ? `bottler=${entity.id}&`
                  : ""
              }`}
              color="primary"
            >
              Add a Bottle
            </Button>

            <Button
              icon={
                <ShareIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
              }
              onClick={() => {
                if (navigator.share) {
                  navigator
                    .share({
                      title: entity.name,
                      url: `/entities/${entity.id}`,
                    })
                    .catch((error) => console.error("Error sharing", error));
                }
              }}
            />

            {user?.mod && (
              <Menu as="div" className="menu">
                <Menu.Button as={Button}>
                  <EllipsisVerticalIcon className="h-5 w-5" />
                </Menu.Button>
                <Menu.Items className="absolute right-0 z-10 mt-2 w-32 origin-top-right lg:left-0 lg:origin-top-left">
                  <Menu.Item as={Link} to={`/entities/${entity.id}/edit`}>
                    Edit Entity
                  </Menu.Item>
                </Menu.Items>
              </Menu>
            )}
          </div>

          <ClientOnly>
            {() => (
              <QueryBoundary
                loading={
                  <div
                    className="mb-4 animate-pulse rounded bg-slate-800"
                    style={{ height: 50 }}
                  />
                }
                fallback={() => null}
              >
                <EntitySpiritDistribution entityId={entity.id} />
              </QueryBoundary>
            )}
          </ClientOnly>
        </div>
        <EntityMap position={entity.location} />
      </div>

      {entity.description && (
        <div className="flex">
          <div className="flex-1">
            <Tabs fullWidth border>
              <Tabs.Item active>Details from Ryebot</Tabs.Item>
            </Tabs>
            <div className="my-6">
              <BetaNotice>
                Ryebot is still getting his bearings. Pardon our dust!
              </BetaNotice>
              <div className="mt-5 flex space-x-4">
                <Collapsable>
                  <div className="prose prose-invert -mt-5 max-w-none flex-1">
                    <Markdown content={entity.description} />
                  </div>
                </Collapsable>

                <img src={RobotImage} className="hidden h-40 w-40 sm:block" />
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs fullWidth>
        <Tabs.Item as={Link} to={baseUrl} controlled>
          Activity
        </Tabs.Item>
        <Tabs.Item as={Link} to={`${baseUrl}/bottles`} controlled>
          Bottles ({entity.totalBottles.toLocaleString()})
        </Tabs.Item>
      </Tabs>

      <Outlet context={{ entity }} />
    </Layout>
  );
}
type Category = {
  category: string;
  count: number;
};

const EntitySpiritDistribution = ({ entityId }: { entityId: number }) => {
  const api = useApi();

  const { data } = useQuery(
    ["entities", entityId, "categories"],
    (): Promise<Paginated<Category> & { totalCount: number }> =>
      api.get(`/entities/${entityId}/categories`),
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
