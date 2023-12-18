import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import EntityIcon from "@peated/web/components/assets/Entity";
import Button from "@peated/web/components/button";
import Chip from "@peated/web/components/chip";
import Layout from "@peated/web/components/layout";
import ShareButton from "@peated/web/components/shareButton";
import Tabs from "@peated/web/components/tabs";
import useAuth from "@peated/web/hooks/useAuth";
import { summarize } from "@peated/web/lib/markdown";
import { getEntityUrl } from "@peated/web/lib/urls";
import type { LinksFunction, MetaFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useParams } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import invariant from "tiny-invariant";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { entityId }, context: { trpc } }) => {
    invariant(entityId);

    const entity = await trpc.entityById.query(Number(entityId));

    return json({ entity });
  },
);

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
      <div className="w-full p-3 lg:py-0">
        <div className="my-4 flex w-full flex-wrap justify-center gap-x-3 gap-y-4 lg:flex-nowrap lg:justify-start">
          <div className="hidden w-14 lg:block">
            <EntityIcon className="h-14 w-auto" />
          </div>

          <div className="flex flex-auto flex-col items-center justify-center truncate lg:w-auto lg:items-start">
            <h1
              className="max-w-full truncate text-center text-3xl font-semibold lg:mx-0 lg:text-left"
              title={entity.name}
            >
              {entity.name}
            </h1>
            <div className="max-w-full text-center text-slate-500 lg:text-left">
              {!!entity.country && (
                <>
                  Located in{" "}
                  <Link
                    to={`/entities?country=${encodeURIComponent(
                      entity.country,
                    )}`}
                    className="truncate hover:underline"
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
                    className="truncate hover:underline"
                  >
                    {entity.region}
                  </Link>
                </span>
              )}
            </div>
          </div>
          <div className="lg:justify-left mb-4 flex w-full justify-center space-x-2 lg:min-w-[200px]">
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

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-auto">
            <div className="my-8 flex justify-center gap-4 lg:justify-start">
              <Button
                to={`/addBottle?${
                  entity.type.indexOf("brand") !== -1
                    ? `brand=${entity.id}&`
                    : ""
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

              <ShareButton title={entity.name} url={`/entities/${entity.id}`} />

              {user?.mod && (
                <Menu as="div" className="menu">
                  <Menu.Button as={Button}>
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </Menu.Button>
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-32 origin-top-right lg:left-0 lg:origin-top-left">
                    <Menu.Item as={Link} to={`/entities/${entity.id}/edit`}>
                      Edit Entity
                    </Menu.Item>
                    <Menu.Item as={Link} to={`/entities/${entity.id}/merge`}>
                      Merge Entity
                    </Menu.Item>
                  </Menu.Items>
                </Menu>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs fullWidth border>
        <Tabs.Item as={Link} to={baseUrl} controlled>
          Overview
        </Tabs.Item>
        <Tabs.Item as={Link} to={`${baseUrl}/bottles`} controlled>
          Bottles ({entity.totalBottles.toLocaleString()})
        </Tabs.Item>
        <Tabs.Item as={Link} to={`${baseUrl}/tastings`} controlled>
          Tastings ({entity.totalTastings.toLocaleString()})
        </Tabs.Item>
      </Tabs>

      <Outlet context={{ entity }} />
    </Layout>
  );
}
