import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";

import type { Bottle, Distiller } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import BottleTable from "../components/bottleTable";
import Button from "../components/button";
import { useRequiredAuth } from "../hooks/useAuth";

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
  const { results: bottleList } = await api.get(`/bottles`, {
    query: { distiller: distiller.id },
  });

  return { distiller, bottleList };
};

export default function DistillerDetails() {
  const { distiller, bottleList } = useLoaderData() as LoaderData;
  const { user: currentUser } = useRequiredAuth();

  const stats = [
    { name: "Bottles", value: distiller.stats.bottles.toLocaleString() },
  ];

  return (
    <Layout gutter>
      <div className="min-w-full flex flex-wrap sm:flex-nowrap my-8 gap-y-4">
        <div className="w-full sm:w-auto sm:flex-1 flex flex-col justify-center">
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
      </div>

      <div className="my-8 justify-center sm:justify-start flex gap-4">
        <Button to={`/distillers/${distiller.id}/edit`}>Edit Distiller</Button>
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
