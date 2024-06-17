import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import Button from "@peated/web/components/button";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Layout from "@peated/web/components/layout";
import ShareButton from "@peated/web/components/shareButton";
import Tabs from "@peated/web/components/tabs";
import useAuth from "@peated/web/hooks/useAuth";
import { summarize } from "@peated/web/lib/markdown";
import { getEntityUrl } from "@peated/web/lib/urls";
import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
  Link,
  Outlet,
  useLoaderData,
  useNavigate,
  useParams,
} from "@remix-run/react";
import { redirect } from "@remix-run/server-runtime";
import invariant from "tiny-invariant";
import EntityHeader from "../components/entityHeader";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";
import { trpc } from "../lib/trpc";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, params, context: { queryUtils } }) => {
    invariant(params.entityId);

    const entityId = Number(params.entityId);

    const entity = await queryUtils.entityById.ensureData(entityId);
    // tombstone path - redirect to the absolute url to ensure search engines dont get mad
    if (entity.id !== entityId) {
      const location = new URL(request.url);
      const newPath = location.pathname.replace(
        `/entities/${entityId}`,
        `/entities/${entity.id}`,
      );
      return redirect(newPath);
    }

    return { entity };
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
  const navigate = useNavigate();

  const baseUrl = getEntityUrl(entity);

  const deleteEntityMutation = trpc.entityDelete.useMutation();
  const deleteEntity = async () => {
    // TODO: show confirmation message
    await deleteEntityMutation.mutateAsync(entity.id);
    navigate("/");
  };

  return (
    <Layout>
      <div className="w-full p-3 lg:py-0">
        <EntityHeader entity={entity} />
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-auto">
            <div className="my-8 flex justify-center gap-4 lg:justify-start">
              <Button
                to={`/addBottle?${
                  entity.type.includes("brand") ? `brand=${entity.id}&` : ""
                }${
                  entity.type.includes("distiller")
                    ? `distiller=${entity.id}&`
                    : ""
                }${
                  entity.type.includes("bottler") ? `bottler=${entity.id}&` : ""
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
                  <Menu.Items
                    className="absolute right-0 z-10 mt-2 w-32 origin-top-right"
                    unmount={false}
                  >
                    <Menu.Item as={Link} to={`/entities/${entity.id}/aliases`}>
                      View Aliases
                    </Menu.Item>
                    <Menu.Item as={Link} to={`/entities/${entity.id}/edit`}>
                      Edit Entity
                    </Menu.Item>
                    <Menu.Item as={Link} to={`/entities/${entity.id}/merge`}>
                      Merge Entity
                    </Menu.Item>
                    {user.admin && (
                      <Menu.Item
                        as={ConfirmationButton}
                        onContinue={deleteEntity}
                        disabled={deleteEntityMutation.isPending}
                      >
                        Delete Entity
                      </Menu.Item>
                    )}
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
