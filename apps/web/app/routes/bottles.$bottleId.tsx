import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import Button from "@peated/web/components/button";
import { ClientOnly } from "@peated/web/components/clientOnly";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Layout from "@peated/web/components/layout";
import QueryBoundary from "@peated/web/components/queryBoundary";
import ShareButton from "@peated/web/components/shareButton";
import SkeletonButton from "@peated/web/components/skeletonButton";
import Tabs from "@peated/web/components/tabs";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { summarize } from "@peated/web/lib/markdown";
import { trpc } from "@peated/web/lib/trpc";
import { type MetaFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useNavigate } from "@remix-run/react";
import { json, redirect } from "@remix-run/server-runtime";
import invariant from "tiny-invariant";
import BottleHeader from "../components/bottleHeader";
import BottlePriceHistory from "../components/bottlePriceHistory.client";
import CollectionAction from "../components/collectionAction";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, params, context: { trpc } }) => {
    invariant(params.bottleId);

    const bottleId = Number(params.bottleId);

    const bottle = await trpc.bottleById.query(bottleId);
    // tombstone path - redirect to the absolute url to ensure search engines dont get mad
    if (bottle.id !== bottleId) {
      const location = new URL(request.url);
      const newPath = location.pathname.replace(
        `/bottles/${bottleId}`,
        `/bottles/${bottle.id}`,
      );
      return redirect(newPath);
    }

    return json({ bottle });
  },
);

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  const description = summarize(data.bottle.description || "", 200);

  return [
    {
      title: data.bottle.fullName,
    },
    {
      name: "description",
      content: description,
    },
    {
      property: "og:title",
      content: data.bottle.fullName,
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

export default function BottleDetails() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { bottle } = useLoaderData<typeof loader>();

  const stats = [
    {
      name: "Avg Rating",
      value:
        bottle.avgRating !== null
          ? Math.round(bottle.avgRating * 100) / 100
          : "",
    },
    { name: "Tastings", value: bottle.totalTastings.toLocaleString() },
    { name: "People", value: bottle.people.toLocaleString() },
  ];

  const deleteBottleMutation = trpc.bottleDelete.useMutation();
  const deleteBottle = async () => {
    // TODO: show confirmation message
    await deleteBottleMutation.mutateAsync(bottle.id);
    navigate("/");
  };

  const baseUrl = `/bottles/${bottle.id}`;

  return (
    <Layout>
      <div className="w-full p-3 lg:py-0">
        <BottleHeader bottle={bottle} />

        <div className="my-8 flex justify-center gap-4 lg:justify-start">
          {user && (
            <ClientOnly fallback={<SkeletonButton className="w-10" />}>
              {() => (
                <QueryBoundary
                  loading={<SkeletonButton className="w-10" />}
                  fallback={() => null}
                >
                  <CollectionAction bottle={bottle} />
                </QueryBoundary>
              )}
            </ClientOnly>
          )}

          <Button to={`/bottles/${bottle.id}/addTasting`} color="primary">
            Record a Tasting
          </Button>

          <ShareButton title={bottle.fullName} url={`/bottles/${bottle.id}`} />

          {user?.mod && (
            <Menu as="div" className="menu">
              <Menu.Button as={Button}>
                <EllipsisVerticalIcon className="h-5 w-5" />
              </Menu.Button>
              <Menu.Items
                className="absolute right-0 z-10 mt-2 w-32 origin-top-right"
                unmount={false}
              >
                <Menu.Item as={Link} to={`/bottles/${bottle.id}/aliases`}>
                  View Aliases
                </Menu.Item>
                <Menu.Item as={Link} to={`/bottles/${bottle.id}/edit`}>
                  Edit Bottle
                </Menu.Item>
                {user.admin && (
                  <Menu.Item
                    as={ConfirmationButton}
                    onContinue={deleteBottle}
                    disabled={deleteBottleMutation.isLoading}
                  >
                    Delete Bottle
                  </Menu.Item>
                )}
              </Menu.Items>
            </Menu>
          )}
        </div>

        <div className="my-6 grid grid-cols-3 items-center gap-3 text-center lg:grid-cols-4 lg:text-left">
          {stats.map((stat) => (
            <div key={stat.name}>
              <div className="text-light leading-7">{stat.name}</div>
              <div className="order-first text-3xl font-semibold tracking-tight lg:text-5xl">
                {stat.value || "-"}
              </div>
            </div>
          ))}
          <div className="hidden lg:block">
            <div className="text-light leading-7">Price</div>
            <div className="flex items-center">
              <ClientOnly fallback={<div className="h-[45px] animate-pulse" />}>
                {() => <BottlePriceHistory bottleId={bottle.id} />}
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>

      <Tabs fullWidth border>
        <Tabs.Item as={Link} to={baseUrl} controlled>
          Overview
        </Tabs.Item>
        <Tabs.Item as={Link} to={`${baseUrl}/tastings`} controlled>
          Tastings ({bottle.totalTastings.toLocaleString()})
        </Tabs.Item>
        <Tabs.Item as={Link} to={`${baseUrl}/prices`} controlled>
          Prices
        </Tabs.Item>
      </Tabs>

      <Outlet context={{ bottle }} />

      {bottle.createdBy && (
        <div className="mt-8 text-center text-sm text-slate-500 sm:text-left">
          This bottle was first added by{" "}
          <Link
            to={`/users/${bottle.createdBy.username}`}
            className="font-medium hover:underline"
          >
            {bottle.createdBy.displayName}
          </Link>{" "}
          {bottle.createdAt && <TimeSince date={bottle.createdAt} />}
        </div>
      )}
    </Layout>
  );
}
