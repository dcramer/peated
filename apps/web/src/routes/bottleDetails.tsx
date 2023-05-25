import { Link, Outlet, useParams } from "react-router-dom";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { Suspense, useState } from "react";
import { ReactComponent as BottleIcon } from "../assets/bottle.svg";
import AddToCollectionModal from "../components/addToCollectionModal";
import BottleMetadata from "../components/bottleMetadata";
import BottleName from "../components/bottleName";
import Button from "../components/button";
import Layout from "../components/layout";
import QueryBoundary from "../components/queryBoundary";
import Tabs from "../components/tabs";
import { TagDistribution } from "../components/tagDistribution";
import TimeSince from "../components/timeSince";
import VintageName from "../components/vintageName";
import useAuth from "../hooks/useAuth";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import { logError } from "../lib/log";
import { formatCategoryName } from "../lib/strings";
import type { Bottle, Collection, Paginated } from "../types";

type BottleWithStats = Bottle & {
  tastings: number;
  avgRating: number;
  people: number;
};

const CollectionAction = ({ bottle }: { bottle: Bottle }) => {
  const {
    data: { results: collectionList },
  } = useSuspenseQuery(
    ["bottles", bottle.id, "collections"],
    (): Promise<Paginated<Collection>> =>
      api.get(`/collections`, {
        query: {
          user: "me",
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
        await api.delete(`/collections/default/bottles/${bottle.id}`);
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
            await api.post("/collections/default/bottles", {
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
  const {
    data: { results, totalCount },
  } = useSuspenseQuery(
    ["bottles", bottleId, "tags"],
    (): Promise<Paginated<Tag> & { totalCount: number }> =>
      api.get(`/bottles/${bottleId}/tags`),
  );

  if (!results.length) return null;

  return <TagDistribution tags={results} totalCount={totalCount} />;
};

export default function BottleDetails() {
  const { user: currentUser } = useAuth();

  const { bottleId } = useParams();
  if (!bottleId) return null;

  const { data: bottle } = useSuspenseQuery(
    ["bottles", bottleId],
    (): Promise<BottleWithStats> => api.get(`/bottles/${bottleId}`),
  );

  const stats = [
    {
      name: "Avg Rating",
      value: Math.round(bottle.avgRating * 100) / 100,
    },
    { name: "Tastings", value: bottle.tastings.toLocaleString() },
    { name: "People", value: bottle.people.toLocaleString() },
  ];

  return (
    <Layout title={`${bottle.brand?.name || ""} ${bottle.name}`}>
      <div className="p-3 sm:py-0">
        <div className="my-4 flex min-w-full flex-wrap gap-x-3 gap-y-4 sm:flex-nowrap">
          <BottleIcon className="hidden h-14 w-auto sm:inline-block" />
          <div className="w-full flex-1 flex-col items-center sm:w-auto sm:items-start">
            <h1 className="mb-2 truncate text-center text-3xl font-semibold leading-7 sm:text-left">
              <BottleName bottle={bottle} />
            </h1>
            {bottle.series && (
              <div className="text-light">
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
          {currentUser && (
            <Suspense fallback={null}>
              <CollectionAction bottle={bottle} />
            </Suspense>
          )}

          {currentUser?.mod && (
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

        <Suspense>
          <BottleTagDistribution bottleId={bottle.id} />
        </Suspense>

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
