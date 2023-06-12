import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { Fragment, Suspense, useState } from "react";
import { ClientOnly } from "remix-utils";
import invariant from "tiny-invariant";

import AddToCollectionModal from "~/components/addToCollectionModal";
import BottleIcon from "~/components/assets/Bottle";
import BottleMetadata from "~/components/bottleMetadata";
import BottleName from "~/components/bottleName";
import Button from "~/components/button";
import { DistributionChart } from "~/components/distributionChart";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import Tabs from "~/components/tabs";
import TimeSince from "~/components/timeSince";
import VintageName from "~/components/vintageName";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import { useSuspenseQuery } from "~/hooks/useSuspenseQuery";
import { logError } from "~/lib/log";
import { formatCategoryName } from "~/lib/strings";
import type { Bottle, Collection, Paginated } from "~/types";

type BottleWithStats = Bottle & {
  tastings: number;
  avgRating: number;
  people: number;
};

const CollectionAction = ({ bottle }: { bottle: Bottle }) => {
  const api = useApi();

  const {
    data: { results: collectionList },
  } = useSuspenseQuery(
    ["bottles", bottle.id, "collections"],
    (): Promise<Paginated<Collection>> =>
      api.get(`/users/me/collections`, {
        query: {
          bottle: bottle.id,
        },
      }),
  );

  const [isCollected, setIsCollected] = useState(collectionList.length > 0);
  const [loading, setLoading] = useState(false);
  const [modalIsOpen, setModalIsOpen] = useState(false);

  const collect = async () => {
    if (loading) return;
    if (isCollected) {
      setLoading(true);
      try {
        await api.delete(`/users/me/collections/default/bottles/${bottle.id}`);
        setIsCollected(false);
      } catch (err: any) {
        logError(err);
      }
      setLoading(false);
    } else {
      setModalIsOpen(true);
    }
  };

  return (
    <>
      <Button onClick={collect} disabled={loading}>
        {isCollected ? "Remove from Collection" : "Add to Collection"}
      </Button>
      <AddToCollectionModal
        bottle={bottle}
        open={modalIsOpen}
        setOpen={setModalIsOpen}
        onSubmit={async (data) => {
          if (loading) return;
          setLoading(true);
          try {
            await api.post("/users/me/collections/default/bottles", {
              data,
            });
            setIsCollected(true);
            setModalIsOpen(false);
          } catch (err: any) {
            logError(err);
          }
          setLoading(false);
        }}
      />
    </>
  );
};

type Tag = { tag: string; count: number };

const BottleTagDistribution = ({ bottleId }: { bottleId: number }) => {
  const api = useApi();

  const { data } = useQuery(
    ["bottles", bottleId, "tags"],
    (): Promise<Paginated<Tag> & { totalCount: number }> =>
      api.get(`/bottles/${bottleId}/tags`),
  );

  if (!data) return null;

  const { results, totalCount } = data;

  if (!results.length) return null;

  return (
    <DistributionChart
      items={results.map((t) => ({
        name: t.tag,
        count: t.count,
        tag: t.tag,
      }))}
      totalCount={totalCount}
      to={(item) => `/bottles?tag=${encodeURIComponent(item.name)}`}
    />
  );
};

export async function loader({ params, context }: LoaderArgs) {
  invariant(params.bottleId);

  const bottle: BottleWithStats = await context.api.get(
    `/bottles/${params.bottleId}`,
  );

  return json({ bottle });
}

export const meta: V2_MetaFunction = ({ data: { bottle } }) => {
  return [
    {
      title: `${bottle.brand?.name || ""} ${bottle.name}`,
    },
  ];
};

export default function BottleDetails() {
  const { user } = useAuth();

  const { bottle } = useLoaderData<typeof loader>();

  const stats = [
    {
      name: "Avg Rating",
      value: Math.round(bottle.avgRating * 100) / 100,
    },
    { name: "Tastings", value: bottle.tastings.toLocaleString() },
    { name: "People", value: bottle.people.toLocaleString() },
  ];

  return (
    <Layout>
      <div className="p-3 sm:py-0">
        <div className="my-4 flex min-w-full flex-wrap gap-x-3 gap-y-4 sm:flex-nowrap">
          <BottleIcon className="hidden h-14 w-auto sm:inline-block" />
          <div className="w-full flex-1 flex-col items-center sm:w-auto sm:items-start">
            <h1 className="mb-2 truncate text-center text-3xl font-semibold leading-7 sm:text-left">
              <BottleName bottle={bottle} />
            </h1>
            {bottle.series && (
              <div className="text-light text-center sm:text-left">
                <VintageName series={bottle.series} />
              </div>
            )}
            <BottleMetadata
              data={bottle}
              className="text-center text-sm text-slate-500 sm:text-left"
            />
          </div>

          {(bottle.category || bottle.statedAge) && (
            <div className="flex w-full flex-col items-center justify-center gap-x-1 text-sm text-slate-500 sm:w-auto sm:items-end sm:leading-7">
              <p>{bottle.category && formatCategoryName(bottle.category)}</p>
              <p>
                {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
              </p>
            </div>
          )}
        </div>

        <div className="my-8 flex justify-center gap-4 sm:justify-start">
          <Button to={`/bottles/${bottle.id}/addTasting`} color="primary">
            Record a Tasting
          </Button>
          {user && (
            <Suspense fallback={null}>
              <CollectionAction bottle={bottle} />
            </Suspense>
          )}

          {user?.mod && (
            <Menu as="div" className="menu">
              <Menu.Button as={Button}>
                <EllipsisVerticalIcon className="h-5 w-5" />
              </Menu.Button>
              <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right">
                <Menu.Item as={Link} to={`/bottles/${bottle.id}/edit`}>
                  Edit Bottle
                </Menu.Item>
              </Menu.Items>
            </Menu>
          )}
        </div>

        <ClientOnly>
          {() => (
            <QueryBoundary fallback={<Fragment />} loading={<Fragment />}>
              <BottleTagDistribution bottleId={bottle.id} />
            </QueryBoundary>
          )}
        </ClientOnly>

        <div className="my-6 grid grid-cols-3 items-center gap-3 text-center sm:text-left">
          {stats.map((stat) => (
            <div key={stat.name}>
              <p className="text-peated-light leading-7">{stat.name}</p>
              <p className="order-first text-3xl font-semibold tracking-tight sm:text-5xl">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-slate-700">
        <Tabs fullWidth>
          <Tabs.Item to={`/bottles/${bottle.id}`} controlled>
            Activity
          </Tabs.Item>
        </Tabs>
      </div>
      <QueryBoundary>
        <Outlet context={{ bottle }} />
      </QueryBoundary>

      {bottle.createdBy && (
        <p className="mt-8 text-center text-sm text-slate-500 sm:text-left">
          This bottle was first added by{" "}
          <Link
            to={`/users/${bottle.createdBy.username}`}
            className="font-medium hover:underline"
          >
            {bottle.createdBy.displayName}
          </Link>{" "}
          <TimeSince date={bottle.createdAt} />
        </p>
      )}
    </Layout>
  );
}
