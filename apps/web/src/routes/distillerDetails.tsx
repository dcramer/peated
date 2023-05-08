import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";

import type { Bottle, Distiller } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import BottleTable from "../components/bottleTable";

type DistillerWithStats = Distiller & {
  stats: {
    bottles: number;
  };
};

type LoaderData = {
  distiller: DistillerWithStats;
  bottleList: Bottle[];
};

export const loader: LoaderFunction = async ({
  params: { distillerId },
}): Promise<LoaderData> => {
  if (!distillerId) throw new Error("Missing distillerId");
  const distiller = await api.get(`/distillers/${distillerId}`);
  const bottleList = await api.get(`/bottles`, {
    query: { distiller: distiller.id },
  });

  return { distiller, bottleList };
};

export default function DistillerDetails() {
  const { distiller, bottleList } = useLoaderData() as LoaderData;

  const stats = [
    { name: "Bottles", value: distiller.stats.bottles.toLocaleString() },
  ];

  return (
    <Layout gutter>
      <div className="flex flex-wrap flex-row items-start justify-between gap-x-8 gap-y-4 mt-2 sm:mt-0">
        <div className="space-y-1 flex-1 w-full sm:w-auto flex flex-col items-center sm:items-start">
          <h1 className="flex gap-x-3 mb-2 leading-7 font-semibold text-3xl text-peated">
            {distiller.name}
          </h1>
          <p className="text-sm font-light text-gray-500">
            Located in {distiller.country}
            {distiller.region && <span> &middot; {distiller.region}</span>}
          </p>
        </div>
      </div>

      <div className="my-8 grid gap-3 grid-cols-1 text-center sm:text-left items-center">
        {stats.map((stat) => (
          <div key={stat.name}>
            <p className="leading-7 text-gray-400">{stat.name}</p>
            <p className="order-first text-3xl font-semibold tracking-tight text-peated sm:text-5xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <BottleTable
        bottleList={bottleList}
        groupBy={(bottle) => bottle.brand}
        groupTo={(group) => `/brands/${group.id}`}
      />
    </Layout>
  );
}
