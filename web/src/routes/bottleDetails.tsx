import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { Link } from "react-router-dom";

import type { Bottle, Checkin } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import CheckinListItem from "../components/checkinListItem";
import { formatCategoryName } from "../lib/strings";
import FloatingCheckinButton from "../components/floatingCheckinButton";

type LoaderData = {
  bottle: Bottle;
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
      <span className="mt-2 block text-sm font-semibold text-gray-400 group-hover:text-peated">
        Are you enjoying a dram?
      </span>

      <span className="mt-2 block text-sm font-light text-gray-400 group-hover:text-peated">
        Looks like no ones recorded this spirit. You could be the first!
      </span>
    </Link>
  );
};

export default function BottleDetails() {
  const { bottle, checkinList } = useLoaderData() as LoaderData;

  const stats = [
    { name: "Checkins", value: "1,234" },
    { name: "Rating", value: 4.5 },
  ];

  return (
    <Layout gutter>
      <FloatingCheckinButton to={`/bottles/${bottle.id}/checkin`} />

      <div className="flex flex-row items-start justify-between gap-x-8">
        <div className="space-y-1 flex-1">
          <h1 className="flex gap-x-3 mb-2 leading-7 font-semibold text-3xl text-peated">
            {bottle.name}
          </h1>
          <p className="text-xs font-light text-gray-500">
            Produced by{" "}
            <Link to={`/brands/${bottle.brand.id}`} className="hover:underline">
              {bottle.brand.name}
            </Link>
            {bottle.distiller &&
              bottle.brand.name !== bottle.distiller.name && (
                <span>
                  {" "}
                  &middot; Distilled at{" "}
                  <Link
                    to={`/distillers/${bottle.brand.id}`}
                    className="hover:underline"
                  >
                    {bottle.distiller.name}
                  </Link>
                </span>
              )}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm leading-6 text-gray-500">
            {bottle.category && formatCategoryName(bottle.category)}
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.name}>
            <p className="text-base leading-7 text-gray-400">{stat.name}</p>
            <p className="order-first text-3xl font-semibold tracking-tight text-peated sm:text-5xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
      <h2 className="text-lg font-semibold leading-6 mt-12 mb-6 text-gray-900">
        Activity
      </h2>
      {checkinList.length ? (
        <ul role="list" className="space-y-3 m-4">
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
