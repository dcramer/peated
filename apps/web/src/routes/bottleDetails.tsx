import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { Link } from "react-router-dom";

import type { Bottle, Tasting } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import TastingListItem from "../components/tastingListItem";
import { formatCategoryName } from "../lib/strings";
import Button from "../components/button";
import BottleName from "../components/bottleName";

type BottleWithStats = Bottle & {
  stats: {
    tastings: number;
    avgRating: number;
    people: number;
  };
};

type LoaderData = {
  bottle: BottleWithStats;
  tastingList: Tasting[];
};

export const loader: LoaderFunction = async ({
  params: { bottleId },
}): Promise<LoaderData> => {
  if (!bottleId) throw new Error("Missing bottleId");
  const bottle = await api.get(`/bottles/${bottleId}`);
  const tastingList = await api.get(`/tastings`, {
    query: { bottle: bottle.id },
  });

  return { bottle, tastingList };
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
  const { bottle, tastingList } = useLoaderData() as LoaderData;

  const stats = [
    {
      name: "Avg Rating",
      value: Math.round(bottle.stats.avgRating * 100) / 100,
    },
    { name: "Tastings", value: bottle.stats.tastings.toLocaleString() },
    { name: "People", value: bottle.stats.people.toLocaleString() },
  ];

  const { distillers } = bottle;
  return (
    <Layout gutter>
      <div className="min-w-full flex flex-wrap sm:flex-nowrap my-8 gap-y-4">
        <div className="space-y-1 flex-1 w-full sm:w-auto flex flex-col items-center sm:items-start">
          <h1 className="flex gap-x-3 mb-2 leading-7 font-semibold text-3xl text-peated">
            <BottleName bottle={bottle} />
          </h1>
          <p className="text-sm font-light text-gray-500">
            Produced by{" "}
            <Link to={`/brands/${bottle.brand.id}`} className="hover:underline">
              {bottle.brand.name}
            </Link>
            {distillers.length > 0 &&
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

      <div className="my-8 justify-center sm:justify-start flex gap-4">
        <Button to={`/bottles/${bottle.id}/addTasting`} color="primary">
          Record a Tasting
        </Button>
        <Button to={`/bottles/${bottle.id}/edit`}>Edit Bottle</Button>
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

      {tastingList.length ? (
        <ul role="list" className="space-y-3">
          {tastingList.map((tasting) => (
            <TastingListItem key={tasting.id} tasting={tasting} noBottle />
          ))}
        </ul>
      ) : (
        <EmptyActivity to={`/bottles/${bottle.id}/addTasting`} />
      )}
    </Layout>
  );
}
