import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { Link } from "react-router-dom";

import type { Bottle, Checkin } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import CheckinListItem from "../components/checkinListItem";
import { formatCategoryName } from "../lib/strings";
import Button from "../components/button";

type BottleWithStats = Bottle & {
  stats: {
    checkins: number;
    avgRating: number;
    people: number;
  };
};

type LoaderData = {
  bottle: BottleWithStats;
  checkinList: Checkin[];
};

export const loader: LoaderFunction = async ({
  params: { bottleId },
}): Promise<LoaderData> => {
  if (!bottleId) throw new Error("Missing bottleId");
  const bottle = await api.get(`/bottles/${bottleId}`);
  const checkinList = await api.get(`/checkins`, {
    query: { bottle: bottle.id },
  });

  return { bottle, checkinList };
};

const EmptyActivity = ({ to }: { to: string }) => {
  return (
    <Link
      type="button"
      className="flex flex-col block m-4 mx-auto items-center rounded-lg border border-dashed border-gray-300 p-12 group hover:border-peated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      to={to}
    >
      <span className="mt-2 block font-semibold text-gray-400 group-hover:text-peated">
        Are you enjoying a dram?
      </span>

      <span className="mt-2 block font-light text-gray-400 group-hover:text-peated">
        Looks like no ones recorded this spirit. You could be the first!
      </span>
    </Link>
  );
};

export default function BottleDetails() {
  const { bottle, checkinList } = useLoaderData() as LoaderData;

  const stats = [
    {
      name: "Avg Rating",
      value: Math.round(bottle.stats.avgRating * 100) / 100,
    },
    { name: "Tastings", value: bottle.stats.checkins.toLocaleString() },
    { name: "People", value: bottle.stats.people.toLocaleString() },
  ];

  const { distillers } = bottle;
  return (
    <Layout gutter>
      <div className="flex flex-wrap flex-row items-start justify-between gap-x-8 gap-y-4 mt-2 sm:mt-0">
        <div className="space-y-1 flex-1 w-full sm:w-auto flex flex-col items-center sm:items-start">
          <h1 className="flex gap-x-3 mb-2 leading-7 font-semibold text-3xl text-peated">
            {bottle.name}
          </h1>
          <p className="text-sm font-light text-gray-500">
            Produced by{" "}
            <Link to={`/brands/${bottle.brand.id}`} className="hover:underline">
              {bottle.brand.name}
            </Link>
            {distillers.length &&
              (distillers.length > 0 ||
                bottle.brand.name !== distillers[0].name) && (
                <span>
                  {" "}
                  &middot; Distilled at{" "}
                  {distillers
                    .map<React.ReactNode>((d) => (
                      <Link
                        key={d.id}
                        to={`/distillers/${d.id}`}
                        className="hover:underline"
                      >
                        {d.name}
                      </Link>
                    ))
                    .reduce((prev, curr) => [prev, ", ", curr])}
                </span>
              )}
          </p>
        </div>
        <div className="space-y-1 w-full sm:w-auto flex flex-col items-center sm:items-start">
          <p className="leading-6 text-gray-500">
            {bottle.category && formatCategoryName(bottle.category)}
          </p>
          <p className="mt-1 text-sm leading-5 text-gray-500">
            {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
          </p>
        </div>
      </div>

      <div className="my-8 text-center sm:text-left">
        <Button to={`/bottles/${bottle.id}/checkin`} color="primary">
          Record a Tasting
        </Button>
      </div>

      <div className="my-8 grid gap-3 grid-cols-3 text-center sm:text-left items-center">
        {stats.map((stat) => (
          <div key={stat.name}>
            <p className="leading-7 text-gray-400">{stat.name}</p>
            <p className="order-first text-3xl font-semibold tracking-tight text-peated sm:text-5xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {checkinList.length ? (
        <ul role="list" className="space-y-3">
          {checkinList.map((checkin) => (
            <CheckinListItem key={checkin.id} checkin={checkin} noBottle />
          ))}
        </ul>
      ) : (
        <EmptyActivity to={`/bottles/${bottle.id}/checkin`} />
      )}
    </Layout>
  );
}
