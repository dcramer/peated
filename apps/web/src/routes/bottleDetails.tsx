import { Link, useParams } from "react-router-dom";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import BottleMetadata from "../components/bottleMetadata";
import BottleName from "../components/bottleName";
import Button from "../components/button";
import EmptyActivity from "../components/emptyActivity";
import Layout from "../components/layout";
import TastingList from "../components/tastingList";
import TimeSince from "../components/timeSince";
import useAuth from "../hooks/useAuth";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import { formatCategoryName } from "../lib/strings";
import type { Bottle, Paginated, Tasting } from "../types";

type BottleWithStats = Bottle & {
  tastings: number;
  avgRating: number;
  people: number;
};

export default function BottleDetails() {
  const { user: currentUser } = useAuth();

  const { bottleId } = useParams();
  const { data: bottle } = useSuspenseQuery(
    ["bottles", bottleId],
    (): Promise<BottleWithStats> => api.get(`/bottles/${bottleId}`),
  );

  const { data: tastingList } = useSuspenseQuery(
    ["bottle", bottleId, "tastings"],
    (): Promise<Paginated<Tasting>> =>
      api.get(`/tastings`, {
        query: { bottle: bottleId },
      }),
  );

  const stats = [
    {
      name: "Avg Rating",
      value: Math.round(bottle.avgRating * 100) / 100,
    },
    { name: "Tastings", value: bottle.tastings.toLocaleString() },
    { name: "People", value: bottle.people.toLocaleString() },
  ];

  const { distillers } = bottle;
  return (
    <Layout>
      <div className="my-4 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap sm:py-0">
        <div className="w-full flex-1 flex-col items-center space-y-1 sm:w-auto sm:items-start">
          <h1 className="mb-2 overflow-hidden text-ellipsis whitespace-nowrap text-3xl font-semibold leading-7">
            <BottleName bottle={bottle} />
          </h1>
          <BottleMetadata
            data={bottle}
            className="overflow-hidden text-ellipsis whitespace-nowrap text-center text-slate-500 sm:text-left"
          />
        </div>

        <div className="flex w-full flex-col items-center space-y-1 space-y-1 text-sm leading-6 text-slate-500 sm:w-auto sm:items-start sm:items-end">
          <p>{bottle.category && formatCategoryName(bottle.category)}</p>
          <p>{bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}</p>
        </div>
      </div>

      <div className="my-8 flex justify-center gap-4 sm:justify-start">
        <Button to={`/bottles/${bottle.id}/addTasting`} color="primary">
          Record a Tasting
        </Button>
        <Menu as="div" className="menu">
          <Menu.Button as={Button}>Add to Collection</Menu.Button>
          <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right">
            <Menu.Item as="button">Default</Menu.Item>
          </Menu.Items>
        </Menu>

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

      <div className="my-8 grid grid-cols-3 items-center gap-3 text-center sm:text-left">
        {stats.map((stat) => (
          <div key={stat.name}>
            <p className="text-peated-light leading-7">{stat.name}</p>
            <p className="order-first text-3xl font-semibold tracking-tight sm:text-5xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {tastingList.results.length ? (
        <TastingList values={tastingList.results} noBottle />
      ) : (
        <EmptyActivity to={`/bottles/${bottle.id}/addTasting`}>
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="mt-2 block font-light">
            Looks like no ones recorded this spirit. You could be the first!
          </span>
        </EmptyActivity>
      )}
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
