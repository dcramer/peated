import { Link, Outlet, useParams } from "react-router-dom";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/shared/lib/strings";
import { Suspense, useState } from "react";
import { ReactComponent as BottleIcon } from "../assets/bottle.svg";
import AddToCollectionModal from "../components/addToCollectionModal";
import BottleMetadata from "../components/bottleMetadata";
import BottleName from "../components/bottleName";
import Button from "../components/button";
import Layout from "../components/layout";
import QueryBoundary from "../components/queryBoundary";
import Tabs from "../components/tabs";
import TimeSince from "../components/timeSince";
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

const TagDistribution = ({ bottleId }: { bottleId: number }) => {
  const {
    data: { results },
  } = useSuspenseQuery(
    ["bottles", bottleId, "tags"],
    (): Promise<Paginated<Tag>> => api.get(`/bottles/${bottleId}/tags`),
  );

  const total = results.reduce((acc, d) => acc + d.count, 0);
  let pctRemaining = 100;

  const colorNames = [
    "bg-slate-600 text-white",
    "bg-slate-700 text-white",
    "bg-slate-800 text-white",
    "bg-slate-900 text-white",
    "bg-slate-950 text-white",
  ];

  const [active, setActive] = useState<Tag | null>(null);

  return (
    <div>
      <div className="relative mb-4 flex h-6 w-full flex-row bg-gray-200 text-xs font-bold">
        {results.slice(0, 4).map((t, index) => {
          const pct = (t.count / total) * 100;
          pctRemaining -= pct;
          return (
            <div
              key={t.tag}
              title={t.tag}
              className={`${colorNames[index]} flex h-6 items-center justify-center`}
              style={{ minWidth: `${pct}%` }}
              onMouseEnter={(e) => setActive(t)}
              onMouseLeave={(e) => setActive(null)}
            >
              {pct > 15 && (
                <span className={pct < 50 ? "hidden px-2 sm:block" : "px-2"}>
                  {t.tag}
                </span>
              )}
            </div>
          );
        })}
        {results.length > 4 && (
          <div
            className={`${colorNames[4]} flex h-6 items-center justify-center`}
            style={{ minWidth: `${pctRemaining}%` }}
            onMouseEnter={(e) =>
              setActive({
                tag: "Other",
                count: (total * pctRemaining) / 100,
              })
            }
            onMouseLeave={(e) => setActive(null)}
          >
            {pctRemaining > 15 && (
              <span
                className={pctRemaining < 50 ? "hidden px-2 sm:block" : "px-2"}
              >
                Other
              </span>
            )}
          </div>
        )}
      </div>
      <div className="text-light flex h-5 items-center justify-center text-sm">
        {!!active && (
          <span>
            {toTitleCase(active.tag)} &mdash;{" "}
            {Math.round((active.count / total) * 100)}%
          </span>
        )}
      </div>
    </div>
  );
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
    <Layout>
      <div className="p-3 sm:py-0">
        <div className="my-4 flex min-w-full flex-wrap gap-x-3 gap-y-4 sm:flex-nowrap">
          <BottleIcon className="hidden h-14 w-auto sm:inline-block" />
          <div className="w-full flex-1 flex-col items-center sm:w-auto sm:items-start">
            <h1 className="mb-2 truncate text-center text-3xl font-semibold leading-7 sm:text-left">
              <BottleName bottle={bottle} />
            </h1>
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
          <Suspense>
            <CollectionAction bottle={bottle} />
          </Suspense>

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
          <TagDistribution bottleId={bottle.id} />
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
