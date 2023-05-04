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
      <div className="flex flex-col items-start justify-between gap-x-8 sm:flex-row sm:items-center">
        <div className="space-y-1 flex-1">
          <h1 className="flex gap-x-3 mb-2 leading-7 font-semibold text-3xl text-peated">
            {distiller.name}
          </h1>
          <p className="text-xs font-light text-gray-500">
            Located in {distiller.country}
            {distiller.region && <span> &middot; {distiller.region}</span>}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {stats.map((stat) => (
          <div key={stat.name}>
            <p className="text-base leading-7 text-gray-400">{stat.name}</p>
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
